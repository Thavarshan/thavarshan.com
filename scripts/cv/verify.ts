import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export async function verifyCv(pdfPath = resolve("cv/output/Jerome-Resume.pdf")) {
  const data = new Uint8Array(await readFile(pdfPath));
  const document = await getDocument({ data, useSystemFonts: true }).promise;

  if (document.numPages > 2) {
    throw new Error(`CV is ${document.numPages} pages; the public CV must be no more than two pages`);
  }

  const text: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    text.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
  }

  const extractedText = text.join("\n");
  for (const requiredText of ["Jerome Thayananthajothy", "Experience", "Education", "github.com/Thavarshan"]) {
    if (!extractedText.includes(requiredText)) {
      throw new Error(`CV text extraction did not contain "${requiredText}"`);
    }
  }
  if (extractedText.includes("+94 742729879")) {
    throw new Error("The public CV contains the private mobile number");
  }

  return { pages: document.numPages, characters: extractedText.length };
}

async function main() {
  const result = await verifyCv(process.argv[2] ? resolve(process.argv[2]) : undefined);
  console.log(`Verified ${result.pages}-page CV with ${result.characters} extractable characters`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
