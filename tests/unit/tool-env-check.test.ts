// @vitest-environment node
import { describe, expect, it } from "vitest";
import { MAX_INPUT_CHARS, MAX_LINES, checkEnv, exampleEnv, exampleEnvBroken, exampleEnvHealthy, formatReport, looksLikeRealSecret, parseEnv, type CheckResult } from "@/lib/tools/env-check";

function check(env: string, example: string): CheckResult {
  const outcome = checkEnv(env, example);
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome.result;
}
const codes = (result: CheckResult) => result.findings.map((finding) => `${finding.code}${finding.key ? `:${finding.key}` : ""}`);

describe("parseEnv", () => {
  it("parses plain, exported, quoted and commented values", () => {
    const { entries, findings } = parseEnv(`# comment\nA=1\nexport B=two\nC="three # not a comment"\nD='four'\nE=five # trailing comment\nF=\n`, "env");
    expect(findings).toEqual([]);
    expect(entries.map((entry) => [entry.key, entry.value, entry.quote, entry.empty])).toEqual([
      ["A", "1", "none", false], ["B", "two", "none", false], ["C", "three # not a comment", "double", false],
      ["D", "four", "single", false], ["E", "five", "none", false], ["F", "", "none", true]
    ]);
  });

  it("supports multi-line quoted values (e.g. private keys)", () => {
    const { entries, findings } = parseEnv('KEY="line one\nline two\nline three"\nNEXT=1\n', "env");
    expect(findings).toEqual([]);
    expect(entries.map((entry) => entry.key)).toEqual(["KEY", "NEXT"]);
    expect(entries[0].value).toBe("line one\nline two\nline three");
    expect(entries[1].line).toBe(4);
  });

  it("flags the classic phpdotenv failure: spaces in an unquoted value", () => {
    const { findings } = parseEnv("APP_NAME=My Great App\n", "env");
    expect(findings[0]).toMatchObject({ code: "unquoted-whitespace", severity: "error", line: 1, key: "APP_NAME" });
    expect(parseEnv('APP_NAME="My Great App"\n', "env").findings).toEqual([]);
  });

  it("flags malformed lines with line numbers", () => {
    const { findings } = parseEnv("GOOD=1\nJUSTAWORD\n1BAD=x\nA-B=y\n", "env");
    expect(findings.map((finding) => [finding.code, finding.line])).toEqual([["no-equals", 2], ["bad-key", 3], ["bad-key", 4]]);
  });

  it("flags an unterminated quote and text after a closing quote", () => {
    expect(parseEnv('A="never closed\nB=1\n', "env").findings.map((finding) => finding.code)).toEqual(["unterminated-quote"]);
    expect(parseEnv('A="ok" junk\n', "env").findings.map((finding) => finding.code)).toEqual(["trailing-after-quote"]);
  });

  it("flags a BOM (it corrupts the first key) and CRLF endings", () => {
    const { entries, findings } = parseEnv("﻿APP_NAME=x\r\nB=1\r\n", "env");
    expect(findings.map((finding) => finding.code)).toEqual(["bom", "crlf"]);
    expect(entries[0].key).toBe("APP_NAME");
  });

  it("does not choke on empty input, only comments, or unusual whitespace", () => {
    expect(parseEnv("", "env").entries).toEqual([]);
    expect(parseEnv("# only\n\n   \n", "env").entries).toEqual([]);
    expect(parseEnv("  A = 1\n", "env").entries[0]).toMatchObject({ key: "A", value: "1" });
  });
});

describe("checkEnv", () => {
  it("passes a healthy pair with only informational notes", () => {
    const example = "APP_ENV=local\nAPP_KEY=\nAPP_DEBUG=true\nDB_HOST=127.0.0.1\n";
    const env = "APP_ENV=local\nAPP_KEY=base64:" + "A".repeat(43) + "=\nAPP_DEBUG=true\nDB_HOST=db\n";
    const result = check(env, example);
    expect(result.counts.error).toBe(0);
    expect(result.counts.warning).toBe(0);
  });

  it("reports missing keys, undocumented keys and empty overrides", () => {
    const result = check("APP_ENV=local\nEXTRA=1\nDB_HOST=\nAPP_KEY=" + "x".repeat(32) + "\n", "APP_ENV=local\nDB_HOST=127.0.0.1\nREDIS_HOST=127.0.0.1\nMAIL_HOST=smtp\n");
    expect(codes(result)).toEqual(expect.arrayContaining(["missing:REDIS_HOST", "missing:MAIL_HOST", "extra:EXTRA", "empty-override:DB_HOST"]));
    expect(result.stats).toMatchObject({ missing: 2, extra: 2, envKeys: 4, exampleKeys: 4 });
    expect(result.missingBlock).toBe("REDIS_HOST=127.0.0.1\nMAIL_HOST=smtp");
  });

  it("detects duplicates in either file", () => {
    const result = check("A=1\nA=2\n", "B=1\nB=2\n");
    expect(codes(result)).toEqual(expect.arrayContaining(["duplicate:A", "duplicate:B"]));
    expect(result.findings.find((finding) => finding.key === "A")?.message).toContain("lines 1, 2");
  });

  it("flags APP_KEY problems and debug-in-production", () => {
    expect(codes(check("APP_ENV=local\n", "APP_ENV=local\n"))).toContain("app-key-missing:APP_KEY");
    expect(codes(check("APP_KEY=\n", ""))).toContain("app-key-empty:APP_KEY");
    expect(codes(check("APP_KEY=short\n", ""))).toContain("app-key-format:APP_KEY");
    const prod = check("APP_ENV=production\nAPP_DEBUG=true\nAPP_KEY=base64:" + "A".repeat(43) + "=\n", "");
    expect(codes(prod)).toContain("debug-in-production:APP_DEBUG");
    expect(prod.counts.error).toBeGreaterThan(0);
    expect(codes(check("APP_ENV=production\nAPP_DEBUG=false\nAPP_KEY=base64:" + "A".repeat(43) + "=\n", ""))).not.toContain("debug-in-production:APP_DEBUG");
  });

  it("warns when .env.example looks like it holds real credentials, without echoing them", () => {
    const result = check("", "STRIPE_SECRET=sk-live-abcdefghijklmnopqrstuvwxyz0123\nAWS_KEY=AKIAIOSFODNN7EXAMPLE\nDB_PASSWORD=secret\nAPP_NAME=Laravel\nSESSION_SECRET=f81d4fae7dec11d0a76500a0c91e6bf6a1b2c3\n");
    expect(codes(result)).toEqual(expect.arrayContaining(["secret-in-example:STRIPE_SECRET", "secret-in-example:AWS_KEY", "secret-in-example:SESSION_SECRET"]));
    expect(codes(result)).not.toContain("secret-in-example:DB_PASSWORD");
    expect(codes(result)).not.toContain("secret-in-example:APP_NAME");
  });

  it("notes ${VAR} references that are not defined earlier, except in single quotes", () => {
    const result = check("A=${B}\nB=1\nC='${D}'\nE=${B}\n", "");
    expect(codes(result).filter((code) => code.startsWith("undefined-reference"))).toEqual(["undefined-reference:A"]);
  });

  it("works with only one of the two files", () => {
    expect(check("APP_KEY=\n", "").stats.missing).toBe(0);
    expect(codes(check("", "A=1\nA=2\n"))).toContain("duplicate:A");
  });

  it("orders findings by severity, then line", () => {
    const severities = check("APP_NAME=My App\nAPP_ENV=local\n", "").findings.map((finding) => finding.severity);
    expect(severities).toEqual([...severities].sort((a, b) => ["error", "warning", "info"].indexOf(a) - ["error", "warning", "info"].indexOf(b)));
  });

  it("runs the bundled sample inputs", () => {
    const healthy = check(exampleEnvHealthy, exampleEnv);
    expect(healthy.stats.missing).toBe(0);
    expect(healthy.counts.error).toBe(0);
    expect(healthy.counts.warning).toBe(0);
    // The bare example used as the .env is (correctly) not healthy: APP_KEY is empty.
    expect(codes(check(exampleEnv, exampleEnv))).toContain("app-key-empty:APP_KEY");
    const broken = check(exampleEnvBroken, exampleEnv);
    expect(codes(broken)).toEqual(expect.arrayContaining(["unquoted-whitespace:APP_NAME", "debug-in-production:APP_DEBUG", "duplicate:DB_HOST", "unterminated-quote:MAIL_FROM_NAME", "app-key-empty:APP_KEY"]));
  });
});

describe("privacy: values never appear in output", () => {
  const SENTINELS = ["ZZ_SENTINEL_PASSWORD_9f8e7d", "ZZ_SENTINEL_TOKEN_1a2b3c", "sk-live-ZZSENTINELSTRIPE0123456789abcdef", "ZZ_SENTINEL_EXAMPLE_SECRET_55aa77bb99cc11dd22ee"];

  it("keeps every value out of findings, the report and the missing-keys block", () => {
    const env = `APP_KEY=\nAPP_ENV=production\nAPP_DEBUG=true\nDB_PASSWORD=${SENTINELS[0]}\nAPI_TOKEN=${SENTINELS[1]}\nSTRIPE_SECRET=${SENTINELS[2]}\nBROKEN=has spaces ${SENTINELS[0]}\nDUP=1\nDUP=${SENTINELS[1]}\nQ="${SENTINELS[0]}\n`;
    const example = `DB_PASSWORD=\nAPI_TOKEN=\nNEW_SECRET_KEY=${SENTINELS[3]}\nSTRIPE_SECRET=${SENTINELS[2]}\nMISSING_TOKEN=${SENTINELS[1]}\n`;
    const result = check(env, example);
    const everything = JSON.stringify(result) + formatReport(result);
    for (const sentinel of SENTINELS) expect(everything, sentinel).not.toContain(sentinel);
    expect(result.missingBlock).toContain("NEW_SECRET_KEY=\n");
    expect(result.missingBlock).toContain("MISSING_TOKEN=");
  });

  it("only echoes non-sensitive example defaults into the missing-keys block", () => {
    const result = check("A=1\n", "A=1\nAPP_URL=http://localhost\nDB_PORT=3306\nMAIL_FROM_NAME=\"Hello World\"\nCACHE_KEY_PREFIX=abc\n");
    expect(result.missingBlock.split("\n")).toEqual(["APP_URL=http://localhost", "DB_PORT=3306", 'MAIL_FROM_NAME="Hello World"', "CACHE_KEY_PREFIX="]);
  });
});

describe("limits and robustness", () => {
  it("rejects empty and oversized input with clear errors instead of hanging", () => {
    expect(checkEnv("", "")).toEqual({ ok: false, error: "Paste your .env, your .env.example, or both." });
    const big = checkEnv("A=1\n".repeat(MAX_LINES + 5), "");
    expect(big.ok).toBe(false);
    const huge = checkEnv("x".repeat(MAX_INPUT_CHARS + 1), "");
    expect(huge).toMatchObject({ ok: false });
  });

  it("handles hostile-looking input without throwing", () => {
    for (const input of ["=", "===", "A=\"", "'''", "\u0000\u0001A=1", "A=" + "\\".repeat(5000), "${".repeat(2000), "export", "export =", "A=$(rm -rf /)\n"]) {
      expect(() => checkEnv(input, input)).not.toThrow();
    }
  });

  it("classifies obvious placeholders as not secret", () => {
    for (const value of ["", "secret", "password", "changeme", "your-key-here", "null", "root", "<token>", "${OTHER}"]) expect(looksLikeRealSecret("API_TOKEN", value), value).toBe(false);
    expect(looksLikeRealSecret("API_TOKEN", "a8f3k29dj4h5g6f7d8s9a0q1w2e3r4")).toBe(true);
    expect(looksLikeRealSecret("APP_NAME", "Laravel")).toBe(false);
  });
});
