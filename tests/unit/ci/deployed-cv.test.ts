// @vitest-environment node
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { verifyCv } from "../../../automation/cv/verify";

/** Small valid PDF, so negative tests exercise extracted content rather than a parse failure. */
function pdf(phone: string) {
  const stream = `BT /F1 12 Tf 20 700 Td (Jerome Thayananthajothy Experience Education github.com/Thavarshan ${phone}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1200 800] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
  ];
  let content = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(content.length);
    content += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = content.length;
  content +=
    `xref\n0 ${offsets.length}\n0000000000 65535 f \n` +
    offsets
      .slice(1)
      .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
      .join("");
  return content + `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
}

it("verifies the phone in a readable deployed PDF and rejects a missing number", async () => {
  const directory = await mkdtemp(join(tmpdir(), "deployed-cv-"));
  try {
    const path = join(directory, "cv.pdf");
    await writeFile(path, pdf("+94742729879"));
    await expect(verifyCv(path)).resolves.toMatchObject({ pages: 1 });
    await writeFile(path, pdf(""));
    await expect(verifyCv(path)).rejects.toThrow("contact phone number");
    await writeFile(path, "not a PDF");
    await expect(verifyCv(path)).rejects.toThrow();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
