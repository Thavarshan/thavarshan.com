import { appendFile, readFile } from "node:fs/promises";
import { z } from "zod";
import { repository } from "./report";

export const reportFeed = { issue: 114, owner: "Thavarshan", marker: "<!-- growth-health-report-feed:v1 -->" } as const;
const apiRoot = `https://api.github.com/repos/${repository}`;
const feedUrl = `https://github.com/${repository}/issues/${reportFeed.issue}`;
const maxBytes = 2 * 1024 * 1024;
const maxPages = 10;
const bot = "github-actions[bot]";
const issueSchema = z.object({
  body: z.string(),
  state: z.enum(["open", "closed"]),
  user: z.object({ login: z.literal(reportFeed.owner) }),
  pull_request: z.never().optional()
});
const commentsSchema = z.array(z.object({ id: z.number().int().positive(), body: z.string(), user: z.object({ login: z.string() }) })).max(100);
const contextSchema = z.object({
  repository: z.literal(repository),
  ref: z.literal("refs/heads/main"),
  event: z.enum(["push", "schedule", "workflow_dispatch"]),
  runId: z.number().int().positive(),
  revision: z.string().regex(/^[a-f0-9]{40}$/),
  token: z.string().min(1)
});
export type NotificationContext = z.infer<typeof contextSchema>;

export function notificationBody(summary: string, context: Pick<NotificationContext, "runId" | "revision">) {
  // Only the trusted main producer's public summary artifact is accepted. Do not introduce extra mentions.
  if (!/^# Growth Engine health: (healthy|watch|attention)\n/.test(summary) || summary.includes("@") || Buffer.byteLength(summary) > 60_000)
    throw new Error("Invalid public report summary");
  if (!Number.isSafeInteger(context.runId) || context.runId <= 0 || !/^[a-f0-9]{40}$/.test(context.revision))
    throw new Error("Invalid notification provenance");
  return `<!-- growth-health-delivery:${context.runId} -->\n\n@${reportFeed.owner} — your Growth Engine report is ready.\n\n${summary.trim()}\n\n[Actions run](https://github.com/${repository}/actions/runs/${context.runId}) · Revision \`${context.revision}\`\n\nEmail is delivered by GitHub according to your notification settings. This is a public report thread; replies to notification emails may appear here.\n`;
}

async function boundedJson(response: Response) {
  if (!response.body) throw new Error("Missing notification response");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let content = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) throw new Error("Notification response exceeds limit");
      content += decoder.decode(value, { stream: true });
    }
    return JSON.parse(content + decoder.decode()) as unknown;
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
}

/** Fixed public thread only; no email credentials, recipient addresses, private state or third-party service. */
export async function notifyReport(summary: string, input: NotificationContext, fetcher: typeof fetch = fetch) {
  const context = contextSchema.parse(input);
  const body = notificationBody(summary, context);
  const request = async (path: string, data?: { body: string }) => {
    const response = await fetcher(`${apiRoot}${path}`, {
      method: data ? "POST" : "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${context.token}`,
        "content-type": "application/json",
        "x-github-api-version": "2022-11-28"
      },
      ...(data ? { body: JSON.stringify(data) } : {})
    });
    if (response.status !== (data ? 201 : 200)) {
      await response.body?.cancel();
      throw new Error("GitHub notification request failed");
    }
    return boundedJson(response);
  };
  const issue = issueSchema.parse(await request(`/issues/${reportFeed.issue}`));
  if (!issue.body.includes(reportFeed.marker)) throw new Error("Incorrect report destination");
  if (issue.state === "closed") return { status: "disabled" as const, url: feedUrl };
  const marker = `<!-- growth-health-delivery:${context.runId} -->`;
  let activated = false;
  let complete = false;
  // Fail safely if the bounded scan cannot prove absence; never blindly append after an API error.
  for (let page = 1; page <= maxPages; page++) {
    const comments = commentsSchema.parse(await request(`/issues/${reportFeed.issue}/comments?per_page=100&page=${page}`));
    for (const comment of comments) {
      if (comment.user.login !== bot) continue;
      if (comment.body.startsWith(marker)) return { status: "already-published" as const, url: `${feedUrl}#issuecomment-${comment.id}` };
      if (/^<!-- growth-health-delivery:[0-9]+ -->/.test(comment.body)) activated = true;
    }
    if (context.event === "push" && activated) return { status: "push-suppressed" as const, url: feedUrl };
    if (comments.length < 100) {
      complete = true;
      break;
    }
  }
  if (!complete) throw new Error("Report thread history exceeds bounded scan; rotate the feed before retrying");
  const result = z
    .object({ id: z.number().int().positive(), user: z.object({ login: z.literal(bot) }) })
    .parse(await request(`/issues/${reportFeed.issue}/comments`, { body }));
  return { status: "published" as const, url: `${feedUrl}#issuecomment-${result.id}` };
}

async function main() {
  const summary = await readFile("test-results/growth-health/summary.md", "utf8");
  const result = await notifyReport(summary, {
    repository: process.env.GITHUB_REPOSITORY as typeof repository,
    ref: process.env.GITHUB_REF as "refs/heads/main",
    event: process.env.GITHUB_EVENT_NAME as NotificationContext["event"],
    runId: Number(process.env.GITHUB_RUN_ID),
    revision: process.env.GITHUB_SHA ?? "",
    token: process.env.GITHUB_TOKEN ?? ""
  });
  const text = `Report notification: **${result.status}** — ${result.url}. Publication does not prove inbox receipt; GitHub email settings control delivery.\n`;
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, text);
}
if (import.meta.url === `file://${process.argv[1]}`)
  await main().catch(() => {
    console.error(
      "Report notification failed; the Actions report is preserved. Retry the notification job after checking the feed and permissions. No credential or response body is logged."
    );
    process.exitCode = 1;
  });
