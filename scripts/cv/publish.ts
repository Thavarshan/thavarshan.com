import { copyFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { buildCv } from "./build";
import { verifyCv } from "./verify";

export const publicCvPath = resolve("public/docs/Jerome-Resume.pdf");

export async function publishCv() {
  const builtCvPath = await buildCv();
  await verifyCv(builtCvPath);
  await mkdir(resolve("public/docs"), { recursive: true });
  await copyFile(builtCvPath, publicCvPath);
  await verifyCv(publicCvPath);
  return publicCvPath;
}

async function main() {
  console.log(`Published ${await publishCv()}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
