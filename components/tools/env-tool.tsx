"use client";

import { AlertOctagon, AlertTriangle, Info, Lock } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { CopyButton } from "@/components/tools/copy-button";
import { plausibleEventClass } from "@/lib/analytics";
import { checkEnv, exampleEnv, exampleEnvBroken, exampleEnvHealthy, formatReport, type Severity } from "@/lib/tools/env-check";

const areaClass =
  "min-h-56 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-3 font-mono text-sm leading-6 text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";
const buttonClass =
  "min-h-11 rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

const severityStyle: Record<Severity, { label: string; icon: typeof Info; box: string }> = {
  error: { label: "Error", icon: AlertOctagon, box: "border-red-300 bg-red-50 text-red-950" },
  warning: { label: "Warning", icon: AlertTriangle, box: "border-amber-400 bg-amber-50 text-amber-950" },
  info: { label: "Note", icon: Info, box: "border-[var(--line)] bg-[var(--surface-strong)] text-[var(--ink)]" }
};

export function EnvTool() {
  const [env, setEnv] = useState("");
  const [example, setExample] = useState("");
  // Deferring keeps typing responsive on large pastes; nothing is persisted or sent anywhere.
  const deferredEnv = useDeferredValue(env);
  const deferredExample = useDeferredValue(example);

  const outcome = useMemo(() => (deferredEnv.trim() || deferredExample.trim() ? checkEnv(deferredEnv, deferredExample) : null), [deferredEnv, deferredExample]);
  const report = outcome?.ok ? formatReport(outcome.result) : "";

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-7" data-testid="env-tool">
      <p className="flex items-start gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-3 text-sm text-[var(--ink)]">
        <Lock size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span><strong>Private by design.</strong> This runs entirely in your browser. Nothing you paste is uploaded, stored or logged, and results show key names and line numbers, never values.</span>
      </p>

      <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-2">
        <div>
          <label htmlFor="env-actual" className="mb-1 block text-sm font-semibold text-[var(--ink)]">.env</label>
          <textarea id="env-actual" className={areaClass} value={env} onChange={(event) => setEnv(event.target.value)} spellCheck={false} autoComplete="off" autoCapitalize="off" autoCorrect="off" placeholder="APP_NAME=Laravel&#10;APP_ENV=production" aria-describedby="env-help" />
        </div>
        <div>
          <label htmlFor="env-example" className="mb-1 block text-sm font-semibold text-[var(--ink)]">.env.example</label>
          <textarea id="env-example" className={areaClass} value={example} onChange={(event) => setExample(event.target.value)} spellCheck={false} autoComplete="off" autoCapitalize="off" autoCorrect="off" placeholder="APP_NAME=Laravel&#10;APP_ENV=local" />
        </div>
      </div>
      <p id="env-help" className="mt-2 text-sm text-[var(--muted)]">Paste both to compare them, or just one to check its syntax. Up to 256,000 characters per file.</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className={`${buttonClass} ${plausibleEventClass("Tool Example Load")}`} onClick={() => { setEnv(exampleEnvBroken); setExample(exampleEnv); }}>Load a broken sample</button>
        <button type="button" className={`${buttonClass} ${plausibleEventClass("Tool Example Load")}`} onClick={() => { setEnv(exampleEnvHealthy); setExample(exampleEnv); }}>Load a healthy sample</button>
        <button type="button" className={buttonClass} onClick={() => { setEnv(""); setExample(""); }}>Clear both</button>
      </div>

      <div className="mt-6" aria-live="polite" data-testid="env-results">
        {outcome === null ? <p className="text-[var(--muted)]">Results appear here as you paste.</p> : null}
        {outcome && !outcome.ok ? <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">Error: {outcome.error}</p> : null}
        {outcome?.ok ? (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
            <p className="text-lg text-[var(--ink)]" data-testid="env-summary">
              {outcome.result.counts.error} error{outcome.result.counts.error === 1 ? "" : "s"}, {outcome.result.counts.warning} warning{outcome.result.counts.warning === 1 ? "" : "s"}, {outcome.result.counts.info} note{outcome.result.counts.info === 1 ? "" : "s"}
              {outcome.result.counts.error + outcome.result.counts.warning === 0 ? " — no problems found." : "."}
            </p>
            <ul className="grid gap-2" data-testid="env-findings">
              {outcome.result.findings.map((finding, index) => {
                const style = severityStyle[finding.severity];
                const Icon = style.icon;
                return (
                  <li key={`${finding.code}-${finding.key ?? ""}-${index}`} className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${style.box}`}>
                    <Icon size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                    <span><strong>{style.label}:</strong> {finding.message}{finding.source ? <span className="text-[var(--muted)]"> ({finding.source === "example" ? ".env.example" : ".env"}{finding.line ? `, line ${finding.line}` : ""})</span> : null}</span>
                  </li>
                );
              })}
            </ul>
            {outcome.result.missingBlock ? (
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--accent-dark)]">Missing keys to add to .env</h3>
                <pre className="mt-2 overflow-x-auto rounded-lg bg-[#202427] p-4 text-sm leading-6 text-[#f7f4ee]" tabIndex={0} aria-label="Missing keys" data-testid="env-missing"><code>{outcome.result.missingBlock}</code></pre>
                <div className="mt-3"><CopyButton text={outcome.result.missingBlock} label="Copy missing keys" /></div>
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-3"><CopyButton text={report} label="Copy full report" /></div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
