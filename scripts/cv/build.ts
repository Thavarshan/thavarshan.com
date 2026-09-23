import { mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { basename, resolve } from "node:path";
import { profile } from "../../data/profile";
import { renderCvSource } from "./render";

const texLiveImage =
  "ghcr.io/xu-cheng/texlive-small:latest@sha256:f6a08603f17dcc949352829fee6109c7e319429718b5e630a0fa32ee9006f98a";

/**
 * Compiles a `.tex` file into a PDF via the same pinned Dockerized `latexmk` used for the public
 * CV. Both `texPath` and `outDir` must be inside the current workspace (the whole workspace is
 * mounted into the container at `/work`), and `sourceDateEpoch` should be a stable, reproducible
 * timestamp — callers pass the source content's own modification time, not "now", so rebuilding
 * from unchanged input produces a byte-identical PDF.
 */
export async function compileLatexToPdf(texPath: string, outDir: string, sourceDateEpoch: number): Promise<string> {
  const workspace = resolve(".");
  await mkdir(resolve(outDir), { recursive: true });

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
      `-outdir=${outDir}`,
      texPath
    ],
    { stdio: "inherit" }
  );

  if (result.status !== 0) {
    throw new Error(`LaTeX compilation failed for ${texPath}`);
  }

  return resolve(outDir, `${basename(texPath, ".tex")}.pdf`);
}

export async function buildCv() {
  await renderCvSource();
  const sourceDateEpoch = Math.floor(new Date(profile.modifiedAt).getTime() / 1000);
  return compileLatexToPdf("cv/generated/Jerome-Resume.tex", "cv/output", sourceDateEpoch);
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
