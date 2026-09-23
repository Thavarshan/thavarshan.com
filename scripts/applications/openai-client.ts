import OpenAI from "openai";
import { withRetry } from "../jobs/concurrency";

export interface RawTailoringResult {
  emphasizedSkillCategories: string[];
  experienceOrder: string[];
  highlightSelections: Array<{ experienceId: string; highlights: string[] }>;
  reviewFlags: string[];
  coverLetterBody: string;
}

const responseJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    emphasizedSkillCategories: {
      type: "array",
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
          highlights: { type: "array", items: { type: "string" } }
        },
        required: ["experienceId", "highlights"]
      }
    },
    reviewFlags: { type: "array", items: { type: "string" } },
    coverLetterBody: { type: "string" }
  },
  required: ["emphasizedSkillCategories", "experienceOrder", "highlightSelections", "reviewFlags", "coverLetterBody"]
};

export async function generateTailoringAndCoverLetter(params: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
}): Promise<RawTailoringResult> {
  const client = new OpenAI({ apiKey: params.apiKey });

  return withRetry(
    async () => {
      const response = await client.chat.completions.create({
        model: params.model,
        messages: [
          { role: "system", content: params.systemPrompt },
          { role: "user", content: params.userPrompt }
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "job_application_tailoring", strict: true, schema: responseJsonSchema }
        }
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error("OpenAI response had no content");
      return JSON.parse(content) as RawTailoringResult;
    },
    { retries: 2, baseDelayMs: 1000 }
  );
}
