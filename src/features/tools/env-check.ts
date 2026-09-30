/**
 * Laravel `.env` / `.env.example` checker. Pure and side-effect free: it runs in the browser and
 * nothing here logs, stores or transmits input. By design NO VALUE EVER APPEARS IN A FINDING —
 * results name keys and line numbers only, because pasted `.env` files contain secrets.
 *
 * Parsing follows vlucas/phpdotenv v5 (what Laravel uses): optional `export`, single/double quotes
 * (quoted values may span lines), `#` comments, and — the classic gotcha — an unquoted value
 * containing whitespace is a parse error.
 */

export const MAX_INPUT_CHARS = 256_000;
export const MAX_LINES = 5_000;

export type Severity = "error" | "warning" | "info";
export type Source = "env" | "example";

export interface Finding {
  severity: Severity;
  code: string;
  message: string;
  source?: Source;
  key?: string;
  line?: number;
}

export interface EnvEntry {
  key: string;
  line: number;
  quote: "none" | "single" | "double";
  empty: boolean;
  /** Raw value; used only for internal checks and never copied into findings or output. */
  value: string;
}

export interface ParsedEnv {
  entries: EnvEntry[];
  findings: Finding[];
}

const keyPattern = /^[A-Za-z_][A-Za-z0-9_.]*$/;

export function parseEnv(text: string, source: Source): ParsedEnv {
  const entries: EnvEntry[] = [];
  const findings: Finding[] = [];
  const add = (finding: Omit<Finding, "source">) => findings.push({ ...finding, source });

  if (text.charCodeAt(0) === 0xfeff) {
    add({ severity: "error", code: "bom", line: 1, message: "The file starts with a UTF-8 byte-order mark (BOM). It becomes part of the first key name, so that variable will not be found. Re-save the file as UTF-8 without BOM." });
    text = text.slice(1);
  }
  if (text.includes("\r\n")) add({ severity: "info", code: "crlf", message: "The file uses Windows (CRLF) line endings. Laravel handles this, but shell tooling and some Docker setups can include the carriage return in values." });

  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const lineNumber = index + 1;
    const trimmed = lines[index].trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;

    const withoutExport = trimmed.replace(/^export\s+/, "");
    const equals = withoutExport.indexOf("=");
    if (equals === -1) {
      add({ severity: "error", code: "no-equals", line: lineNumber, message: `Line ${lineNumber} is not a comment or a KEY=value pair (there is no "=").` });
      continue;
    }

    const key = withoutExport.slice(0, equals).trim();
    if (!keyPattern.test(key)) {
      add({ severity: "error", code: "bad-key", line: lineNumber, message: `Line ${lineNumber}: "${key.length > 40 ? `${key.slice(0, 40)}…` : key}" is not a valid variable name (use letters, digits and underscores, not starting with a digit).` });
      continue;
    }

    let rest = withoutExport.slice(equals + 1).trimStart();
    let quote: EnvEntry["quote"] = "none";
    let value = "";
    const startLine = lineNumber;

    if (rest.startsWith('"') || rest.startsWith("'")) {
      const mark = rest[0];
      quote = mark === '"' ? "double" : "single";
      let body = rest.slice(1);
      let closed = false;
      for (;;) {
        let escaped = false;
        let end = -1;
        for (let position = 0; position < body.length; position++) {
          const char = body[position];
          if (escaped) { escaped = false; continue; }
          if (char === "\\" && (mark === '"' || body[position + 1] === "'")) { escaped = true; continue; }
          if (char === mark) { end = position; break; }
        }
        if (end !== -1) {
          value += body.slice(0, end);
          const after = body.slice(end + 1).trim();
          if (after !== "" && !after.startsWith("#")) {
            add({ severity: "error", code: "trailing-after-quote", line: startLine, message: `Line ${startLine}: unexpected text after the closing quote of ${key}.` });
          }
          closed = true;
          break;
        }
        value += body;
        if (index + 1 >= lines.length) break;
        index += 1;
        value += "\n";
        body = lines[index];
      }
      if (!closed) {
        add({ severity: "error", code: "unterminated-quote", line: startLine, key, message: `Line ${startLine}: the quoted value for ${key} is never closed (missing ${mark}). Everything after it would be swallowed into this value.` });
        continue;
      }
    } else {
      const commentAt = rest.search(/\s#/);
      if (commentAt !== -1) rest = rest.slice(0, commentAt);
      value = rest.trim();
      if (/\s/.test(value)) {
        add({ severity: "error", code: "unquoted-whitespace", line: lineNumber, key, message: `Line ${lineNumber}: ${key} has spaces in an unquoted value. Laravel's dotenv parser rejects this ("unexpected whitespace") and the whole app fails to boot — wrap the value in double quotes.` });
      }
      if (value.includes("#")) {
        add({ severity: "info", code: "hash-in-value", line: lineNumber, key, message: `Line ${lineNumber}: the value of ${key} contains "#". It is kept because no whitespace precedes it, but quote the value to make the intent unambiguous.` });
      }
    }

    entries.push({ key, line: startLine, quote, empty: value === "", value });
  }

  return { entries, findings };
}

const secretKeyPattern = /(KEY|SECRET|PASSWORD|PASSWD|TOKEN|PRIVATE|CREDENTIAL|DSN)/i;
const knownSecretShapes = [/^sk-[A-Za-z0-9_-]{16,}/, /^AKIA[0-9A-Z]{16}/, /^ghp_[A-Za-z0-9]{20,}/, /^xox[baprs]-/, /^AIza[0-9A-Za-z_-]{20,}/, /^-----BEGIN/, /^base64:[A-Za-z0-9+/=]{40,}$/];

/** Heuristic only: true when a value in a sensitive-looking key resembles a real credential. */
export function looksLikeRealSecret(key: string, value: string): boolean {
  if (value === "") return false;
  if (knownSecretShapes.some((shape) => shape.test(value))) return true;
  if (!secretKeyPattern.test(key)) return false;
  const placeholder = /^(null|none|secret|password|changeme|change_me|your[-_ ]?.*|example|xxx+|\*+|<.*>|\$\{.*\}|token|key|123456?|homestead|root|laravel|sail)$/i;
  if (placeholder.test(value)) return false;
  return value.length >= 24 && /[A-Za-z]/.test(value) && /\d/.test(value);
}

export interface CheckResult {
  findings: Finding[];
  counts: Record<Severity, number>;
  stats: { envKeys: number; exampleKeys: number; missing: number; extra: number };
  /** `KEY=` lines for keys present in the example but missing from .env (example values only when they are not secret-like). */
  missingBlock: string;
}

export type CheckOutcome = { ok: true; result: CheckResult } | { ok: false; error: string };

const severityOrder: Record<Severity, number> = { error: 0, warning: 1, info: 2 };

function duplicates(entries: EnvEntry[], source: Source): Finding[] {
  const byKey = new Map<string, number[]>();
  for (const entry of entries) byKey.set(entry.key, [...(byKey.get(entry.key) ?? []), entry.line]);
  return [...byKey.entries()]
    .filter(([, lines]) => lines.length > 1)
    .map(([key, lines]) => ({
      severity: "warning" as const, code: "duplicate", source, key, line: lines[0],
      message: `${key} is defined ${lines.length} times (lines ${lines.join(", ")}). Remove the extras; which one wins depends on the loader.`
    }));
}

function interpolationFindings(entries: EnvEntry[], source: Source): Finding[] {
  const findings: Finding[] = [];
  const defined = new Set<string>();
  for (const entry of entries) {
    if (entry.quote !== "single") {
      for (const match of entry.value.matchAll(/\$\{([A-Za-z_][A-Za-z0-9_.]*)\}/g)) {
        if (!defined.has(match[1])) {
          findings.push({
            severity: "info", code: "undefined-reference", source, key: entry.key, line: entry.line,
            message: `${entry.key} references \${${match[1]}}, which is not defined earlier in this file. That is fine if the system environment provides it; otherwise it expands to an empty string.`
          });
        }
      }
    }
    defined.add(entry.key);
  }
  return findings;
}

function get(entries: EnvEntry[], key: string) {
  return [...entries].reverse().find((entry) => entry.key === key);
}

function semanticFindings(entries: EnvEntry[]): Finding[] {
  const findings: Finding[] = [];
  const appKey = get(entries, "APP_KEY");
  if (!appKey) findings.push({ severity: "error", code: "app-key-missing", source: "env", key: "APP_KEY", message: "APP_KEY is not set. Laravel cannot encrypt sessions or cookies without it — run `php artisan key:generate`." });
  else if (appKey.empty) findings.push({ severity: "error", code: "app-key-empty", source: "env", key: "APP_KEY", line: appKey.line, message: "APP_KEY is empty. Run `php artisan key:generate`." });
  else if (!/^base64:[A-Za-z0-9+/]{43}=$/.test(appKey.value) && !(appKey.value.length === 32 && !appKey.value.startsWith("base64:"))) {
    findings.push({ severity: "warning", code: "app-key-format", source: "env", key: "APP_KEY", line: appKey.line, message: "APP_KEY does not look like a Laravel key (expected base64: followed by 44 characters for AES-256-CBC, or a raw 32-character key). Regenerate it with `php artisan key:generate` unless you set it deliberately." });
  }

  const env = get(entries, "APP_ENV");
  const debug = get(entries, "APP_DEBUG");
  const isProduction = env && /^(production|prod)$/i.test(env.value);
  const debugOn = debug && /^(true|1|on|yes)$/i.test(debug.value);
  if (isProduction && debugOn) {
    findings.push({ severity: "error", code: "debug-in-production", source: "env", key: "APP_DEBUG", line: debug?.line, message: "APP_DEBUG is on while APP_ENV is production. Error pages will expose stack traces, configuration and environment details. Set APP_DEBUG=false." });
  }
  if (!env) findings.push({ severity: "warning", code: "app-env-missing", source: "env", key: "APP_ENV", message: "APP_ENV is not set; Laravel falls back to 'production', which may not be what you expect locally." });
  return findings;
}

export function checkEnv(envText: string, exampleText: string): CheckOutcome {
  if (envText.length > MAX_INPUT_CHARS || exampleText.length > MAX_INPUT_CHARS) {
    return { ok: false, error: `Input is too large (limit ${MAX_INPUT_CHARS.toLocaleString("en-US")} characters per file). Real .env files are far smaller — check you pasted the right file.` };
  }
  if (envText.split("\n").length > MAX_LINES || exampleText.split("\n").length > MAX_LINES) {
    return { ok: false, error: `Input has too many lines (limit ${MAX_LINES.toLocaleString("en-US")}).` };
  }
  if (envText.trim() === "" && exampleText.trim() === "") return { ok: false, error: "Paste your .env, your .env.example, or both." };

  const env = parseEnv(envText, "env");
  const example = parseEnv(exampleText, "example");
  const findings: Finding[] = [...env.findings, ...example.findings, ...duplicates(env.entries, "env"), ...duplicates(example.entries, "example")];

  const envKeys = new Set(env.entries.map((entry) => entry.key));
  const exampleKeys = new Set(example.entries.map((entry) => entry.key));
  const hasEnv = envText.trim() !== "";
  const hasExample = exampleText.trim() !== "";

  const missing: EnvEntry[] = [];
  if (hasEnv && hasExample) {
    for (const entry of example.entries) {
      if (!envKeys.has(entry.key) && !missing.some((item) => item.key === entry.key)) {
        missing.push(entry);
        findings.push({ severity: "error", code: "missing", source: "env", key: entry.key, message: `${entry.key} is in .env.example but missing from .env.` });
      }
    }
    for (const key of envKeys) {
      if (!exampleKeys.has(key)) findings.push({ severity: "info", code: "extra", source: "env", key, line: get(env.entries, key)?.line, message: `${key} is in .env but not documented in .env.example. Add it (with a safe placeholder) so teammates and CI know it exists.` });
    }
    for (const entry of env.entries) {
      const documented = get(example.entries, entry.key);
      if (documented && !documented.empty && entry.empty) {
        findings.push({ severity: "warning", code: "empty-override", source: "env", key: entry.key, line: entry.line, message: `${entry.key} is empty in .env although .env.example provides a default.` });
      }
    }
  }

  for (const entry of example.entries) {
    if (looksLikeRealSecret(entry.key, entry.value)) {
      findings.push({ severity: "warning", code: "secret-in-example", source: "example", key: entry.key, line: entry.line, message: `${entry.key} in .env.example looks like a real credential. This file is normally committed to git — replace it with a placeholder and rotate the secret if it was ever real.` });
    }
  }

  if (hasEnv) findings.push(...semanticFindings(env.entries), ...interpolationFindings(env.entries, "env"));
  if (hasExample) findings.push(...interpolationFindings(example.entries, "example"));

  findings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity] || (a.line ?? 0) - (b.line ?? 0) || a.code.localeCompare(b.code));

  const counts: Record<Severity, number> = { error: 0, warning: 0, info: 0 };
  for (const finding of findings) counts[finding.severity]++;

  const missingBlock = missing
    .map((entry) => (entry.empty || looksLikeRealSecret(entry.key, entry.value) || secretKeyPattern.test(entry.key) ? `${entry.key}=` : `${entry.key}=${entry.quote === "double" ? `"${entry.value}"` : entry.quote === "single" ? `'${entry.value}'` : entry.value}`))
    .join("\n");

  return {
    ok: true,
    result: { findings, counts, stats: { envKeys: envKeys.size, exampleKeys: exampleKeys.size, missing: missing.length, extra: hasEnv && hasExample ? [...envKeys].filter((key) => !exampleKeys.has(key)).length : 0 }, missingBlock }
  };
}

export function formatReport(result: CheckResult): string {
  const lines = [`# .env check — ${result.counts.error} error(s), ${result.counts.warning} warning(s), ${result.counts.info} note(s)`, ""];
  for (const finding of result.findings) {
    const where = [finding.source === "example" ? ".env.example" : finding.source === "env" ? ".env" : "", finding.line ? `line ${finding.line}` : ""].filter(Boolean).join(", ");
    lines.push(`[${finding.severity.toUpperCase()}] ${finding.message}${where ? ` (${where})` : ""}`);
  }
  if (result.missingBlock) lines.push("", "# Missing keys to add to .env:", result.missingBlock);
  return `${lines.join("\n")}\n`;
}

export const exampleEnv = `APP_NAME=Laravel
APP_ENV=production
APP_KEY=
APP_DEBUG=false
APP_URL=http://localhost

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=laravel
DB_USERNAME=root
DB_PASSWORD=

MAIL_MAILER=smtp
MAIL_FROM_ADDRESS="hello@example.com"
MAIL_FROM_NAME="\${APP_NAME}"
`;

/** A healthy counterpart to exampleEnv: same keys, with a well-formed APP_KEY (this is a throwaway sample, not a secret). */
export const exampleEnvHealthy = exampleEnv.replace("APP_KEY=", `APP_KEY=base64:${"Q".repeat(43)}=`);

export const exampleEnvBroken = `APP_NAME=My Great App
APP_ENV=production
APP_KEY=
APP_DEBUG=true
APP_URL=http://localhost
DB_HOST=127.0.0.1
DB_HOST=db.internal
DB_PORT=3306
DB_DATABASE=laravel
DB_USERNAME=root
DB_PASSWORD=
STRIPE_SECRET=sk-live-thisIsNotARealKeyButLooksLikeOne123
MAIL_FROM_NAME="\${APP_NAME}
`;
