import OpenAI from "openai";
import { getEncoding } from "js-tiktoken";
import { z } from "zod";
import type { ProfessionalProfile } from "../../src/features/profile/profile-schema";

export const GROQ_MODEL = "openai/gpt-oss-20b";
export const GROQ_GENERATOR_VERSION = "groq-v2";
export const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const MAX_INPUT_TOKENS = 5500;
const MAX_OUTPUT_TOKENS = 2500;
const MAX_REQUESTS = 11; // one access probe plus up to five packages with one transient retry
const REQUEST_INTERVAL_MS = 65000;
let tokenizer: ReturnType<typeof getEncoding> | undefined;
export interface RawTailoringResult {
  emphasizedSkillCategories: string[];
  experienceOrder: string[];
  highlightSelections: Array<{ experienceId: string; highlights: string[] }>;
  reviewFlags: string[];
  coverLetterBody: string;
}

export const responseJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    emphasizedSkillCategories: {
      type: "array",
      minItems: 4,
      maxItems: 4,
      items: { type: "string", enum: ["leadership", "ai-architecture", "full-stack", "cloud-delivery"] }
    },
    experienceOrder: { type: "array", items: { type: "string" } },
    highlightSelections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          experienceId: { type: "string" },
          highlightIndices: { type: "array", items: { type: "integer", minimum: 0 } }
        },
        required: ["experienceId", "highlightIndices"]
      }
    },
    reviewFlags: { type: "array", items: { type: "string" } },
    coverLetterBody: { type: "string" }
  },
  required: ["emphasizedSkillCategories", "experienceOrder", "highlightSelections", "reviewFlags", "coverLetterBody"]
};

const rawResultSchema = z.strictObject({
  emphasizedSkillCategories: z.array(z.enum(["leadership", "ai-architecture", "full-stack", "cloud-delivery"])).length(4),
  experienceOrder: z.array(z.string().min(1).max(100)).max(30),
  highlightSelections: z
    .array(z.strictObject({ experienceId: z.string().min(1).max(100), highlightIndices: z.array(z.number().int().min(0).max(100)).max(20) }))
    .max(30),
  reviewFlags: z.array(z.string().max(1000)).max(20),
  coverLetterBody: z.string().min(100).max(6000)
});

export function groqConfiguration(env: Record<string, string | undefined>) {
  if (!env.GROQ_API_KEY?.trim()) throw new Error("GROQ_API_KEY is required for AI mode");
  if (env.GROQ_FREE_PLAN_CONFIRMED !== "true") throw new Error("Confirm the Groq Free plan with GROQ_FREE_PLAN_CONFIRMED=true before AI generation");
  if (env.GROQ_MODEL && env.GROQ_MODEL !== GROQ_MODEL) throw new Error("Unsupported Groq model; only openai/gpt-oss-20b is allowed");
  return { apiKey: env.GROQ_API_KEY, model: GROQ_MODEL };
}

/** Ordinary GPT-OSS text shares o200k_base ranks; reserve 512 tokens for Harmony/schema framing.
 * This is a conservative local estimate, not a guarantee of the provider's quota accounting. */
export function estimatedInputTokens(systemPrompt: string, userPrompt: string, schema: object = responseJsonSchema) {
  if (Buffer.byteLength(systemPrompt + userPrompt, "utf8") > 100000) throw new GroqFailure("Groq input exceeds the local prompt budget");
  tokenizer ??= getEncoding("o200k_base");
  return tokenizer.encode(systemPrompt + "\n" + userPrompt + "\n" + JSON.stringify(schema), [], []).length + 512;
}

export class GroqFailure extends Error {}

export function safeGroqError(error: unknown): Error {
  const status = (error as { status?: number })?.status;
  if (status === 401) return new GroqFailure("Groq authentication failed; replace GROQ_API_KEY");
  if (status === 403 || status === 404) return new GroqFailure("Groq model access is unavailable; check model permissions");
  if (status === 429) return new GroqFailure("Groq free quota or rate limit is unavailable; retry later without upgrading");
  return new GroqFailure("Groq request failed or timed out; no provider payload was logged");
}

export function responseSchemaForProfile(profile: Pick<ProfessionalProfile, "experience">) {
  if (!profile.experience.length) throw new GroqFailure("Groq tailoring requires verified profile experience");
  const ids = profile.experience.map((role) => role.id);
  return {
    ...responseJsonSchema,
    properties: {
      ...responseJsonSchema.properties,
      experienceOrder: { type: "array", items: { type: "string", enum: ids } },
      highlightSelections: {
        type: "array",
        items: {
          anyOf: profile.experience.map((role) => ({
            type: "object",
            additionalProperties: false,
            properties: {
              experienceId: { type: "string", enum: [role.id] },
              highlightIndices: {
                type: "array",
                items: role.highlights.length ? { type: "integer", enum: role.highlights.map((_, index) => index) } : { type: "integer" },
                ...(role.highlights.length ? {} : { maxItems: 0 })
              }
            },
            required: ["experienceId", "highlightIndices"]
          }))
        }
      }
    }
  };
}

export function createGroqApplicationClient(apiKey: string, runtime: { fetch?: typeof fetch; now?: () => number; sleep?: (ms: number) => Promise<void> } = {}) {
  const client = new OpenAI({ apiKey, baseURL: GROQ_BASE_URL, maxRetries: 0, timeout: 60000, fetch: runtime.fetch });
  const now = runtime.now ?? Date.now;
  const sleep = runtime.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const metrics = { requests: 0, inputTokens: 0, outputTokens: 0 };
  let lastRequest: number | undefined;

  async function request(body: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming) {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (metrics.requests >= MAX_REQUESTS) throw new GroqFailure("Groq run request budget exhausted");
      if (lastRequest !== undefined) await sleep(Math.max(0, REQUEST_INTERVAL_MS - (now() - lastRequest)));
      lastRequest = now();
      metrics.requests++;
      try {
        const response = await client.chat.completions.create(body);
        metrics.inputTokens += response.usage?.prompt_tokens ?? 0;
        metrics.outputTokens += response.usage?.completion_tokens ?? 0;
        return response;
      } catch (error) {
        // Retry one server failure only. Authentication, quota, timeouts, and bad input fail immediately.
        const status = (error as { status?: number })?.status;
        if (attempt === 0 && status !== undefined && status >= 500 && status <= 599) continue;
        throw safeGroqError(error);
      }
    }
    throw new GroqFailure("Groq retry budget exhausted");
  }

  return {
    metrics,
    async verifyAccess() {
      // A tiny inference verifies authentication, model access and currently available quota.
      // It does not validate full package generation or prove account billing status.
      const response = await request({
        model: GROQ_MODEL,
        messages: [{ role: "user", content: "Reply OK." }],
        max_completion_tokens: 128,
        reasoning_effort: "low"
      });
      if (!Array.isArray(response.choices) || !response.choices.length) throw new GroqFailure("Groq access probe returned no completion");
    },
    async generate(params: { systemPrompt: string; userPrompt: string; profile: Pick<ProfessionalProfile, "experience"> }): Promise<RawTailoringResult> {
      const schema = responseSchemaForProfile(params.profile);
      if (estimatedInputTokens(params.systemPrompt, params.userPrompt, schema) > MAX_INPUT_TOKENS)
        throw new GroqFailure("Groq input exceeds the local prompt budget");
      const response = await request({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: params.systemPrompt },
          { role: "user", content: params.userPrompt }
        ],
        max_completion_tokens: MAX_OUTPUT_TOKENS,
        reasoning_effort: "low",
        response_format: { type: "json_schema", json_schema: { name: "job_application_tailoring", strict: true, schema } }
      });
      const choice = response.choices?.[0];
      if (choice?.finish_reason !== "stop" || !choice.message.content || choice.message.refusal)
        throw new GroqFailure("Groq returned missing, refused or truncated application output");
      try {
        const raw = rawResultSchema.parse(JSON.parse(choice.message.content));
        const highlightSelections = raw.highlightSelections.map(({ experienceId, highlightIndices }) => {
          const role = params.profile.experience.find((item) => item.id === experienceId);
          if (!role || new Set(highlightIndices).size !== highlightIndices.length || highlightIndices.some((index) => index >= role.highlights.length))
            throw new GroqFailure("Groq output selected duplicate or out-of-range profile highlights");
          return { experienceId, highlights: highlightIndices.map((index) => role.highlights[index]) };
        });
        return { ...raw, highlightSelections };
      } catch (error) {
        if (error instanceof GroqFailure) throw error;
        const knownFields = ["emphasizedSkillCategories", "experienceOrder", "highlightSelections", "reviewFlags", "coverLetterBody"];
        const fields =
          error instanceof z.ZodError ? [...new Set(error.issues.map((issue) => String(issue.path[0])).filter((field) => knownFields.includes(field)))] : [];
        throw new GroqFailure(`Groq application output failed structured validation${fields.length ? ` (${fields.join(", ")})` : ""}`);
      }
    }
  };
}
