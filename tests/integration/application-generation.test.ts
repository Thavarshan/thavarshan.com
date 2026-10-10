// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { makeOpportunity } from "../helpers/opportunity";
import { generateApplications } from "@automation/applications/generate";
import { readState } from "@automation/applications/state";
import { prepareApplication } from "@/features/applications/template";
import { parseProfessionalProfile } from "@/features/profile/profile-schema";
import { githubSnapshotSchema } from "@/features/github/github-model";
import { computeInputHash } from "@automation/applications/generate";
import { GROQ_GENERATOR_VERSION, GROQ_MODEL, safeGroqError } from "@automation/applications/groq-client";

const mocks = vi.hoisted(() => ({ clone: vi.fn(), push: vi.fn(), ai: vi.fn(), probe: vi.fn(), compile: vi.fn(), fixture: "" }));
vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...actual,
    readFile: (...args: Parameters<typeof actual.readFile>) => {
      if (mocks.fixture && String(args[0]) === resolve("data/jobs.generated.json")) return Promise.resolve(mocks.fixture);
      return actual.readFile(...args);
    }
  };
});
vi.mock("@automation/applications/private-repo", () => ({
  applicationsRepoSlug: "Test/private-applications",
  clonePrivateRepo: mocks.clone,
  commitAndPush: mocks.push
}));
vi.mock("@automation/applications/groq-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@automation/applications/groq-client")>()),
  createGroqApplicationClient: () => ({ generate: mocks.ai, verifyAccess: mocks.probe, metrics: { requests: 1, inputTokens: 0, outputTokens: 0 } })
}));
vi.mock("@automation/cv/build", () => ({ compileLatexToPdf: mocks.compile }));
const snapshot = JSON.parse(await readFile("data/jobs.generated.json", "utf8"));
const id = "0123456789abcdef0123";
let dir: string;
let log: ReturnType<typeof vi.spyOn>;
let errorLog: ReturnType<typeof vi.spyOn>;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "application-test-"));
  vi.stubEnv("APPLICATIONS_REPO_DEPLOY_KEY", "synthetic-key");
  vi.stubEnv("APPLICATIONS_MODE", "template");
  vi.stubEnv("APPLICATIONS_JOB_ID", id);
  vi.stubEnv("GROQ_API_KEY", "synthetic-provider-key");
  vi.stubEnv("GROQ_FREE_PLAN_CONFIRMED", "true");
  vi.stubEnv("APPLICATIONS_AUTOMATION_ENABLED", "true");
  vi.stubEnv("GITHUB_STEP_SUMMARY", "");
  mocks.probe.mockResolvedValue(undefined);
  log = vi.spyOn(console, "log").mockImplementation(() => {});
  errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.clone.mockResolvedValue(dir);
  mocks.push.mockResolvedValue(true);
  mocks.compile.mockImplementation(async (tex: string, out: string) => {
    const pdf = resolve(out, `${basename(tex, ".tex")}.pdf`);
    await writeFile(pdf, "synthetic PDF");
    return pdf;
  });
  const fixture = { ...snapshot, opportunities: [makeOpportunity({ id, eligibility: "eligible", score: 90, tags: ["Laravel"] })] };
  mocks.fixture = JSON.stringify(fixture);
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  mocks.fixture = "";
  await rm(dir, { recursive: true, force: true });
  await rm(resolve(".applications-build"), { recursive: true, force: true });
});

describe("private template generation", () => {
  it("creates PDFs, evidence and pending state without contacting AI or leaking drafts", async () => {
    await generateApplications();
    expect(mocks.ai).not.toHaveBeenCalled();
    expect(mocks.push).toHaveBeenCalledOnce();
    expect((await readState(dir)).entries[0]).toMatchObject({ opportunityId: id, model: "template-v1", status: "pending" });
    await access(join(dir, id, "cv.pdf"));
    expect(await readFile(join(dir, id, "preparation.md"), "utf8")).toContain("Evidence-backed match matrix");
    expect(JSON.stringify(log.mock.calls)).not.toContain("professional profile");
    await expect(access(resolve(".applications-build"))).rejects.toThrow();
  });

  it("publishes nothing when compilation fails and hides raw error content", async () => {
    mocks.compile.mockRejectedValueOnce(new Error("PRIVATE DRAFT CONTENT"));
    await expect(generateApplications()).rejects.toThrow("no private changes were published");
    expect(mocks.push).not.toHaveBeenCalled();
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain("PRIVATE DRAFT CONTENT");
    await expect(access(join(dir, "state.json"))).rejects.toThrow();
    await expect(access(resolve(".applications-build"))).rejects.toThrow();
  });

  it("fails closed on malformed private state without overwriting it", async () => {
    await writeFile(join(dir, "state.json"), "not JSON");
    await expect(generateApplications()).rejects.toThrow("Invalid private application state");
    expect(await readFile(join(dir, "state.json"), "utf8")).toBe("not JSON");
    expect(mocks.ai).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("rejects malformed snapshots before accessing private storage", async () => {
    mocks.fixture = JSON.stringify({ ...snapshot, opportunities: [{ id: "bad" }] });
    await expect(generateApplications()).rejects.toThrow();
    expect(mocks.clone).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("rejects a selected ineligible job before private storage", async () => {
    mocks.fixture = JSON.stringify({ ...snapshot, opportunities: [makeOpportunity({ id, eligibility: "ineligible" })] });
    await expect(generateApplications()).rejects.toThrow("not eligible");
    expect(mocks.clone).not.toHaveBeenCalled();
  });

  it("never regenerates an applied job", async () => {
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, "state.json"),
      JSON.stringify({
        schemaVersion: 1,
        entries: [{ opportunityId: id, inputHash: "old", generatedAt: "2026-10-09T00:00:00.000Z", model: "old", status: "applied" }]
      })
    );
    await generateApplications();
    expect(mocks.compile).not.toHaveBeenCalled();
    expect((await readState(dir)).entries[0].status).toBe("applied");
  });
});

const profile = parseProfessionalProfile(JSON.parse(await readFile("data/profile.generated.json", "utf8")));
const github = githubSnapshotSchema.parse(JSON.parse(await readFile("data/github.generated.json", "utf8")));
function validAiResult() {
  const preparation = prepareApplication(profile, github, JSON.parse(mocks.fixture).opportunities[0]);
  return Object.fromEntries(
    ["emphasizedSkillCategories", "experienceOrder", "highlightSelections", "reviewFlags", "coverLetterBody"].map((key) => [
      key,
      preparation[key as keyof typeof preparation]
    ])
  );
}

describe("private Groq preparation", () => {
  beforeEach(() => {
    vi.stubEnv("APPLICATIONS_MODE", "ai");
  });

  it("probes access and publishes a validated representative package", async () => {
    mocks.ai.mockResolvedValue(validAiResult());
    await generateApplications();
    expect(mocks.probe).toHaveBeenCalledOnce();
    expect(mocks.ai).toHaveBeenCalledOnce();
    expect(mocks.push).toHaveBeenCalledOnce();
    expect((await readState(dir)).entries[0].model).toBe(`${GROQ_GENERATOR_VERSION}:${GROQ_MODEL}`);
  });
  it("probes inference access even for unchanged input and reports a truthful no-op", async () => {
    const job = JSON.parse(mocks.fixture).opportunities[0];
    const model = `${GROQ_GENERATOR_VERSION}:${GROQ_MODEL}`;
    await writeFile(
      join(dir, "state.json"),
      JSON.stringify({
        schemaVersion: 1,
        entries: [
          { opportunityId: id, inputHash: computeInputHash(job, profile, github, model), generatedAt: "2026-10-10T00:00:00.000Z", model, status: "pending" }
        ]
      })
    );
    vi.stubEnv("GITHUB_STEP_SUMMARY", join(dir, "actions-summary"));
    await generateApplications();
    expect(mocks.probe).toHaveBeenCalledOnce();
    expect(mocks.ai).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
    const summary = await readFile(join(dir, "actions-summary"), "utf8");
    expect(summary).toContain("Outcome: no-op");
    expect(summary).toContain("not a billing or full-package guarantee");
    expect(summary).not.toContain(id);
  });
  for (const secret of ["GROQ_API_KEY", "APPLICATIONS_REPO_DEPLOY_KEY"]) {
    it(`fails visibly for missing ${secret}`, async () => {
      vi.stubEnv(secret, "");
      await expect(generateApplications()).rejects.toThrow();
      expect(mocks.probe).not.toHaveBeenCalled();
      expect(mocks.clone).not.toHaveBeenCalled();
      expect(mocks.push).not.toHaveBeenCalled();
    });
  }
  it("does not open private storage after an unusable provider access probe", async () => {
    mocks.probe.mockRejectedValue(new Error("PRIVATE PROVIDER RESPONSE"));
    await expect(generateApplications()).rejects.toThrow();
    expect(mocks.clone).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
  });
  it("preserves the previous state and publishes nothing after a provider generation failure", async () => {
    const oldState = JSON.stringify({ schemaVersion: 1, entries: [] });
    await writeFile(join(dir, "state.json"), oldState);
    mocks.ai.mockRejectedValue(new Error("PRIVATE PROMPT"));
    await expect(generateApplications()).rejects.toThrow("no private changes were published");
    expect(await readFile(join(dir, "state.json"), "utf8")).toBe(oldState);
    expect(mocks.push).not.toHaveBeenCalled();
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain("PRIVATE PROMPT");
  });
  it("does not publish an earlier successful package when a later package fails", async () => {
    vi.stubEnv("APPLICATIONS_JOB_ID", "");
    const first = JSON.parse(mocks.fixture).opportunities[0];
    mocks.fixture = JSON.stringify({ ...snapshot, opportunities: [first, { ...first, id: "1123456789abcdef0123", score: 80 }] });
    const oldState = JSON.stringify({ schemaVersion: 1, entries: [] });
    await writeFile(join(dir, "state.json"), oldState);
    mocks.ai.mockResolvedValueOnce(validAiResult()).mockRejectedValueOnce(new Error("PRIVATE PROMPT"));
    await expect(generateApplications()).rejects.toThrow("no private changes were published");
    expect(mocks.compile).toHaveBeenCalledTimes(2);
    expect(mocks.push).not.toHaveBeenCalled();
    expect(await readFile(join(dir, "state.json"), "utf8")).toBe(oldState);
  });
  it("reports a safe quota diagnostic without exposing provider response contents", async () => {
    vi.stubEnv("GITHUB_STEP_SUMMARY", join(dir, "actions-summary"));
    mocks.probe.mockRejectedValueOnce(safeGroqError({ status: 429, message: "PRIVATE PROMPT" }));
    await expect(generateApplications()).rejects.toThrow();
    const summary = await readFile(join(dir, "actions-summary"), "utf8");
    expect(summary).toContain("free quota or rate limit");
    expect(summary).not.toContain("PRIVATE PROMPT");
    expect(summary).toContain("Outcome: failed");
  });
  it("fails instead of repairing invented CV highlights or unknown experience IDs", async () => {
    mocks.ai.mockResolvedValue({ ...validAiResult(), highlightSelections: [{ experienceId: profile.experience[0].id, highlights: ["Invented achievement"] }] });
    await expect(generateApplications()).rejects.toThrow("no private changes were published");
    expect(mocks.compile).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
  });
  it("fails visibly on private push errors with no published outcome", async () => {
    mocks.ai.mockResolvedValue(validAiResult());
    mocks.push.mockRejectedValue(new Error("PRIVATE SSH RESPONSE"));
    vi.stubEnv("GITHUB_STEP_SUMMARY", join(dir, "actions-summary"));
    await expect(generateApplications()).rejects.toThrow();
    const summary = await readFile(join(dir, "actions-summary"), "utf8");
    expect(summary).toContain("Outcome: failed");
    expect(summary).toContain("Stage: private publication");
    expect(summary).not.toContain("PRIVATE SSH RESPONSE");
  });
  it("distinguishes explicitly disabled automation without probing or storage access", async () => {
    vi.stubEnv("APPLICATIONS_AUTOMATION_ENABLED", "false");
    vi.stubEnv("GROQ_API_KEY", "");
    vi.stubEnv("GITHUB_STEP_SUMMARY", join(dir, "actions-summary"));
    await generateApplications();
    expect(mocks.probe).not.toHaveBeenCalled();
    expect(mocks.clone).not.toHaveBeenCalled();
    expect(await readFile(join(dir, "actions-summary"), "utf8")).toContain("Outcome: disabled");
  });
});
