import process from "node:process";
import console from "node:console";
import { failedJobs } from "./gate.mjs";

/** Dispatched Actions job checks are not evaluated by branch rulesets. Record the actual gate result as a commit status. */
export async function publishGateStatus(env, fetcher = globalThis.fetch) {
  if (env.GITHUB_EVENT_NAME !== "workflow_dispatch" || env.GITHUB_REPOSITORY !== "Thavarshan/thavarshan.com")
    throw new Error("Only this repository's dispatched CI may record a gate status");
  if (!/^[a-f0-9]{40}$/.test(env.GITHUB_SHA ?? "") || !/^[1-9][0-9]*$/.test(env.GITHUB_RUN_ID ?? "") || !env.GITHUB_TOKEN)
    throw new Error("Missing gate status provenance or credentials");
  const results = JSON.parse(env.JOB_RESULTS || "{}");
  const state = env.GATE_RESULT === "success" && failedJobs(results).length === 0 ? "success" : "failure";
  const response = await fetcher(`https://api.github.com/repos/Thavarshan/thavarshan.com/statuses/${env.GITHUB_SHA}`, {
    method: "POST",
    redirect: "manual",
    signal: globalThis.AbortSignal.timeout(10000),
    headers: {
      authorization: `Bearer ${env.GITHUB_TOKEN}`,
      accept: "application/vnd.github+json",
      "content-type": "application/json",
      "x-github-api-version": "2022-11-28"
    },
    body: JSON.stringify({
      state,
      context: "ci-gate",
      target_url: `https://github.com/Thavarshan/thavarshan.com/actions/runs/${env.GITHUB_RUN_ID}`,
      description: state === "success" ? "All mandatory CI jobs passed on this revision" : "Mandatory CI gate did not pass"
    })
  });
  await response.body?.cancel();
  if (response.status !== 201) throw new Error("Commit gate status could not be recorded");
  return state;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const state = await publishGateStatus(process.env);
    console.log(`Recorded dispatched CI commit status: ci-gate=${state}`);
  } catch {
    console.error("Dispatched CI gate status publication failed; credentials and API errors were suppressed.");
    process.exitCode = 1;
  }
}
