import { mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { profile } from "../../data/profile";
import { renderCvSource } from "./render";

const texLiveImage =
  "ghcr.io/xu-cheng/texlive-small:latest@sha256:f6a08603f17dcc949352829fee6109c7e319429718b5e630a0fa32ee9006f98a";

export async function buildCv() {
  await renderCvSource();
  const workspace = resolve(".");
  const sourceDateEpoch = Math.floor(new Date(profile.modifiedAt).getTime() / 1000).toString();
  await mkdir(resolve("cv/output"), { recursive: true });

  const result = spawnSync(
    "docker",
    [
      "run",
      "--rm",
      "--platform",
      "linux/amd64",
      "-e",
      `SOURCE_DATE_EPOCH=${sourceDateEpoch}`,
      "-e",
      "FORCE_SOURCE_DATE=1",
      "-v",
      `${workspace}:/work`,
      "-w",
      "/work",
      texLiveImage,
      "latexmk",
      "-lualatex",
      "-interaction=nonstopmode",
      "-halt-on-error",
      "-outdir=cv/output",
      "cv/generated/Jerome-Resume.tex"
    ],
    { stdio: "inherit" }
  );

  if (result.status !== 0) {
    throw new Error("LaTeX CV compilation failed");
  }

  return resolve("cv/output/Jerome-Resume.pdf");
}

async function main() {
  console.log(`Built ${await buildCv()}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
