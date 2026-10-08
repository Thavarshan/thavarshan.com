import process from "node:process";
import console from "node:console";
export const requiredJobs = ["quality", "browser", "seo", "cv", "lighthouse", "security"];

export function failedJobs(results) {
  return requiredJobs.filter((job) => results[job]?.result !== "success");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const failures = failedJobs(JSON.parse(process.env.JOB_RESULTS || "{}"));
  if (failures.length) {
    console.error(`Required CI jobs did not succeed: ${failures.join(", ")}`);
    process.exitCode = 1;
  }
}
