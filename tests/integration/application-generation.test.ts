// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { makeOpportunity } from "../helpers/opportunity";
import { generateApplications } from "@automation/applications/generate";
import { readState } from "@automation/applications/state";

const mocks = vi.hoisted(() => ({ clone: vi.fn(), push: vi.fn(), ai: vi.fn(), compile: vi.fn(), fixture: "" }));
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
vi.mock("@automation/applications/openai-client", () => ({ generateTailoringAndCoverLetter: mocks.ai }));
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
  vi.stubEnv("ENABLE_PAID_AI", "false");
  vi.stubEnv("OPENAI_API_KEY", "");
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
