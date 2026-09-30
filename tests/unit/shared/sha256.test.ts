// @vitest-environment node
import { createHash, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { sha256Hex } from "@/shared/edge/sha256";

const reference = (input: string | Uint8Array) => createHash("sha256").update(input).digest("hex");

describe("sha256Hex matches Node's crypto exactly", () => {
  it("published test vectors", () => {
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(sha256Hex("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")).toBe("248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1");
    expect(sha256Hex("a".repeat(1_000_000))).toBe("cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0");
  });

  it("every length around the padding boundaries (0-200 bytes)", () => {
    for (let length = 0; length <= 200; length++) {
      const text = "x".repeat(length);
      expect(sha256Hex(text), `length ${length}`).toBe(reference(text));
    }
  });

  it("multi-byte UTF-8, emoji and control characters", () => {
    for (const text of ["héllo wörld", "日本語のテキスト", "தமிழ்", "🚀 launch — “quoted” ‘text’", "tab\tnew\nline\u0000nul", "\u{10FFFF}"]) {
      expect(sha256Hex(text), text).toBe(reference(text));
    }
  });

  it("raw bytes, including large inputs", () => {
    for (const size of [1, 63, 64, 65, 1000, 65_536, 3_000_000]) {
      const bytes = randomBytes(size);
      expect(sha256Hex(new Uint8Array(bytes)), `${size} bytes`).toBe(reference(bytes));
    }
  });

  it("FUZZ: 1,000 random strings", () => {
    let seed = 2026;
    const next = (n: number) => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed % n; };
    for (let i = 0; i < 1000; i++) {
      const text = Array.from({ length: next(300) }, () => String.fromCodePoint(32 + next(0x2500))).join("");
      expect(sha256Hex(text)).toBe(reference(text));
    }
  });

  it("is fast enough for archive-sized input", () => {
    const bytes = new Uint8Array(randomBytes(8_000_000));
    const started = performance.now();
    sha256Hex(bytes);
    expect(performance.now() - started).toBeLessThan(3000);
  });
});
