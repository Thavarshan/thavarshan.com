// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createGroqApplicationClient, GROQ_BASE_URL, GROQ_MODEL, estimatedInputTokens } from "@automation/applications/groq-client";

const result = {
  emphasizedSkillCategories: ["leadership", "ai-architecture", "full-stack", "cloud-delivery"],
  experienceOrder: ["verified-role"],
  highlightSelections: [{ experienceId: "verified-role", highlights: ["Verified original highlight"] }],
  reviewFlags: [],
  coverLetterBody: "A reviewable draft based solely on verified profile facts, with no invented credentials or employers. Thank you for your consideration."
};
const providerResult = { ...result, highlightSelections: [{ experienceId: "verified-role", highlightIndices: [0] }] };
function completion(content = JSON.stringify(providerResult), finish = "stop") {
  return new Response(
    JSON.stringify({
      id: "fixture",
      choices: [{ index: 0, finish_reason: finish, message: { role: "assistant", content } }],
      usage: { prompt_tokens: 20, completion_tokens: 30 }
    }),
    { headers: { "content-type": "application/json" } }
  );
}
function harness() {
  let elapsed = 0;
  const requests: { url: string; body: Record<string, unknown> }[] = [];
  const response = vi.fn().mockImplementation(() => completion());
  const fetcher: typeof fetch = async (input, init) => {
    requests.push({ url: String(input), body: JSON.parse(String(init?.body)) });
    return response();
  };
  const sleep = vi.fn(async (ms: number) => {
    elapsed += ms;
  });
  const client = createGroqApplicationClient("synthetic-provider-key", { fetch: fetcher, now: () => elapsed, sleep });
  return { client, requests, response, sleep };
}
const prompts = {
  systemPrompt: "Use verified facts only.",
  userPrompt: "Untrusted job and verified profile data.",
  profile: { experience: [{ id: "verified-role", highlights: ["Verified original highlight"] }] } as Parameters<
    ReturnType<typeof createGroqApplicationClient>["generate"]
  >[0]["profile"]
};

describe("Groq bounded inference", () => {
  it("routes exclusively to Groq with strict schema, fixed model, token limits and pacing", async () => {
    const h = harness();
    await h.client.verifyAccess();
    expect(await h.client.generate(prompts)).toEqual(result);
    expect(h.requests.every((r) => r.url === `${GROQ_BASE_URL}/chat/completions`)).toBe(true);
    expect(h.requests[1].body).toMatchObject({
      model: GROQ_MODEL,
      max_completion_tokens: 2500,
      response_format: { type: "json_schema", json_schema: { strict: true } }
    });
    expect(h.requests[1].body).toMatchObject({
      response_format: {
        json_schema: {
          schema: {
            properties: {
              highlightSelections: {
                items: { anyOf: [{ properties: { experienceId: { enum: ["verified-role"] }, highlightIndices: { items: { enum: [0] } } } }] }
              }
            }
          }
        }
      }
    });
    expect(h.sleep).toHaveBeenCalledWith(65000);
    expect(h.client.metrics).toMatchObject({ requests: 2, inputTokens: 40, outputTokens: 60 });
  });
  for (const [status, message] of [
    [401, "authentication"],
    [403, "model access"],
    [404, "model access"],
    [429, "quota"]
  ] as const) {
    it(`fails immediately and redacts provider bodies for HTTP ${status}`, async () => {
      const h = harness();
      h.response.mockResolvedValue(new Response(JSON.stringify({ error: { message: "PRIVATE PROMPT AND CREDENTIAL" } }), { status }));
      await expect(h.client.generate(prompts)).rejects.toThrow(message);
      expect(h.requests).toHaveLength(1);
    });
  }
  it("retries only one server error and paces that retry", async () => {
    const h = harness();
    h.response.mockResolvedValueOnce(new Response("provider unavailable", { status: 503 }));
    await h.client.generate(prompts);
    expect(h.requests).toHaveLength(2);
    expect(h.sleep).toHaveBeenCalledWith(65000);
    const failed = harness();
    failed.response.mockImplementation(() => new Response("unavailable", { status: 503 }));
    await expect(failed.client.generate(prompts)).rejects.toThrow("request failed");
    expect(failed.requests).toHaveLength(2);
  });
  it("does not retry timeouts or transport failures", async () => {
    const h = harness();
    h.response.mockRejectedValue(new DOMException("PRIVATE DATA", "AbortError"));
    await expect(h.client.generate(prompts)).rejects.toThrow("request failed or timed out");
    expect(h.requests).toHaveLength(1);
  });
  it("rejects truncated, malformed, missing and schema-invalid output without retrying", async () => {
    for (const response of [
      completion(JSON.stringify(providerResult), "length"),
      completion("PRIVATE NON JSON"),
      completion(""),
      completion(JSON.stringify({ ...providerResult, coverLetterBody: 42 })),
      completion(JSON.stringify({ ...providerResult, unexpected: true })),
      completion(JSON.stringify({ ...providerResult, highlightSelections: [{ experienceId: "verified-role", highlightIndices: [99] }] })),
      completion(JSON.stringify({ ...providerResult, highlightSelections: [{ experienceId: "unknown", highlightIndices: [0] }] })),
      completion(JSON.stringify({ ...providerResult, highlightSelections: [{ experienceId: "verified-role", highlightIndices: [0, 0] }] }))
    ]) {
      const h = harness();
      h.response.mockResolvedValue(response);
      await expect(h.client.generate(prompts)).rejects.toThrow();
      expect(h.requests).toHaveLength(1);
    }
  });
  it("rejects over-budget prompts before calling the provider and caps total requests", async () => {
    const h = harness();
    expect(estimatedInputTokens(prompts.systemPrompt, prompts.userPrompt)).toBeLessThan(5000);
    await expect(h.client.generate({ ...prompts, userPrompt: "invalid ".repeat(20000) })).rejects.toThrow("prompt budget");
    expect(h.requests).toHaveLength(0);
    for (let i = 0; i < 11; i++) await h.client.verifyAccess();
    await expect(h.client.verifyAccess()).rejects.toThrow("request budget");
    expect(h.requests).toHaveLength(11);
  });
});
