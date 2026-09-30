"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { CopyButton } from "@/components/tools/copy-button";
import { track } from "@/lib/telemetry/client";
import { cronPresets, explainCron, isValidTimezone, laravelSnippets, nextRuns, parseCron, toLaravelChain } from "@/lib/tools/cron";

const commonTimezones = ["UTC", "Asia/Colombo", "Asia/Kolkata", "Asia/Singapore", "Asia/Tokyo", "Australia/Sydney", "Europe/London", "Europe/Berlin", "America/New_York", "America/Chicago", "America/Los_Angeles"];
const commandPattern = /^[A-Za-z0-9:_.-]{1,80}$/;
const fieldClass =
  "min-h-11 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-base text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

// Client-only values via useSyncExternalStore: the server snapshot is null/"UTC" so the static HTML is
// deterministic, and the client snapshot takes over after hydration. The clock refreshes every minute so
// "next runs" never goes stale if the tab is left open.
let cachedNow: number | null = null;
function subscribeToClock(onChange: () => void) {
  const timer = setInterval(() => { cachedNow = Date.now(); onChange(); }, 60_000);
  return () => clearInterval(timer);
}
const getClockSnapshot = () => (cachedNow ??= Date.now());
const getServerClock = () => null;
const noopSubscribe = () => () => undefined;
function getBrowserTimezone() {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return zone && isValidTimezone(zone) ? zone : "UTC";
}

export function CronTool() {
  const [expression, setExpression] = useState("30 9 * * 1-5");
  const [command, setCommand] = useState("emails:send");
  const [timezoneChoice, setTimezoneChoice] = useState<string | null>(null);
  const [version, setVersion] = useState<"modern" | "legacy">("modern");

  const nowMs = useSyncExternalStore(subscribeToClock, getClockSnapshot, getServerClock);
  const now = useMemo(() => (nowMs === null ? null : new Date(nowMs)), [nowMs]);
  const browserTimezone = useSyncExternalStore(noopSubscribe, getBrowserTimezone, () => "UTC");
  const timezone = timezoneChoice ?? browserTimezone;

  const parsed = useMemo(() => parseCron(expression), [expression]);
  const commandValid = commandPattern.test(command);
  const safeCommand = commandValid ? command : "your:command";

  const output = useMemo(() => {
    if (!parsed.ok) return null;
    const suggestion = toLaravelChain(parsed.cron);
    return {
      explanation: explainCron(parsed.cron),
      suggestion,
      snippets: laravelSnippets(safeCommand, suggestion.chain, timezone),
      runs: now ? nextRuns(parsed.cron, now, 8, timezone) : []
    };
  }, [parsed, safeCommand, timezone, now]);

  // A valid result shown after the visitor changed the input counts as a completed use (once per page view).
  const completed = Boolean(output) && expression !== "30 9 * * 1-5";
  useEffect(() => {
    if (completed) track("tool_completed", { tool: "laravel-scheduler-cron" }, { once: true });
  }, [completed]);

  const zones = commonTimezones.includes(timezone) ? commonTimezones : [timezone, ...commonTimezones];
  const formatter = (zone: string) => new Intl.DateTimeFormat("en-GB", { timeZone: zone, weekday: "short", year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-7" data-testid="cron-tool">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[2fr_1fr_1fr]">
        <div>
          <label htmlFor="cron-expression" className="mb-1 block text-sm font-semibold text-[var(--ink)]">Cron expression</label>
          <input
            id="cron-expression"
            className={`${fieldClass} font-mono`}
            value={expression}
            onChange={(event) => setExpression(event.target.value)}
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            maxLength={200}
            aria-describedby="cron-help cron-error"
            aria-invalid={!parsed.ok}
          />
          <p id="cron-help" className="mt-1 text-sm text-[var(--muted)]">Five fields: minute hour day-of-month month weekday, or a macro such as @daily.</p>
        </div>
        <div>
          <label htmlFor="cron-command" className="mb-1 block text-sm font-semibold text-[var(--ink)]">Artisan command</label>
          <input id="cron-command" className={`${fieldClass} font-mono`} value={command} onChange={(event) => setCommand(event.target.value)} spellCheck={false} autoComplete="off" maxLength={80} aria-invalid={!commandValid} aria-describedby="cron-command-help" />
          <p id="cron-command-help" className="mt-1 text-sm text-[var(--muted)]">{commandValid ? "Used only in the code snippet." : "Use letters, digits and : _ . - only."}</p>
        </div>
        <div>
          <label htmlFor="cron-timezone" className="mb-1 block text-sm font-semibold text-[var(--ink)]">Timezone</label>
          <select id="cron-timezone" className={fieldClass} value={timezone} onChange={(event) => setTimezoneChoice(event.target.value)}>
            {zones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
          </select>
        </div>
      </div>

      <fieldset className="mt-5">
        <legend className="mb-2 text-sm font-semibold text-[var(--ink)]">Common schedules</legend>
        <div className="flex flex-wrap gap-2">
          {cronPresets.map((preset) => (
            <button
              key={preset.expression}
              type="button"
              onClick={() => setExpression(preset.expression)}
              className={`min-h-11 rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-sm text-[var(--ink)] transition hover:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mt-6" aria-live="polite" data-testid="cron-results">
        <p id="cron-error" role={parsed.ok ? undefined : "alert"} className={parsed.ok ? "sr-only" : "rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900"}>
          {parsed.ok ? "Expression is valid." : `Error: ${parsed.error}`}
        </p>

        {parsed.ok && output ? (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--accent-dark)]">Meaning</h3>
              <p className="mt-1 text-xl text-[var(--ink)]" data-testid="cron-explanation">{output.explanation}</p>
            </div>

            {parsed.cron.warnings.map((warning) => (
              <p key={warning} className="rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm text-amber-950">Warning: {warning}</p>
            ))}

            <div>
              <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--accent-dark)]">Laravel</h3>
              <p className="mt-1 text-[var(--muted)]" data-testid="cron-match">
                {output.suggestion.fluent ? "A built-in helper matches this schedule exactly:" : "No built-in helper matches this schedule exactly, so use cron():"}
              </p>
              <div role="group" aria-label="Laravel version" className="mt-3 flex flex-wrap gap-2">
                <button type="button" aria-pressed={version === "modern"} onClick={() => setVersion("modern")} className={`min-h-11 rounded-lg border px-3 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${version === "modern" ? "border-[var(--ink)] bg-[var(--ink)] text-white" : "border-[var(--line)] bg-[var(--surface-strong)]"}`}>Laravel 11+</button>
                <button type="button" aria-pressed={version === "legacy"} onClick={() => setVersion("legacy")} className={`min-h-11 rounded-lg border px-3 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${version === "legacy" ? "border-[var(--ink)] bg-[var(--ink)] text-white" : "border-[var(--line)] bg-[var(--surface-strong)]"}`}>Laravel 10 and earlier</button>
              </div>
              <pre className="mt-3 overflow-x-auto rounded-lg bg-[#202427] p-4 text-sm leading-6 text-[#f7f4ee]" tabIndex={0} aria-label="Laravel schedule code" data-testid="cron-code"><code>{output.snippets[version]}</code></pre>
              <div className="mt-3 flex flex-wrap items-center gap-3"><CopyButton text={output.snippets[version]} label="Copy code" tool="laravel-scheduler-cron" /></div>
            </div>

            <div>
              <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--accent-dark)]">Next runs</h3>
              {output.runs.length === 0 ? (
                <p className="mt-1 text-[var(--muted)]" data-testid="cron-runs">{now ? "This schedule has no run within the next nine years." : "Calculating…"}</p>
              ) : (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[28rem] border-collapse text-left text-sm" data-testid="cron-runs">
                    <caption className="sr-only">Upcoming run times in {timezone} and UTC</caption>
                    <thead><tr className="border-b border-[var(--line)]"><th scope="col" className="py-2 pr-4 font-semibold">{timezone}</th><th scope="col" className="py-2 font-semibold">UTC</th></tr></thead>
                    <tbody>
                      {output.runs.map((run) => (
                        <tr key={run.toISOString()} className="border-b border-[var(--line)]/60">
                          <td className="py-2 pr-4">{formatter(timezone).format(run)}</td>
                          <td className="py-2 text-[var(--muted)]">{formatter("UTC").format(run)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
