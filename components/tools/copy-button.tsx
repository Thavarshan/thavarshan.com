"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/telemetry/client";

type CopyButtonProps = {
  text: string;
  label: string;
  className?: string;
  /** Which tool produced the text, for the tool_output_copied event. */
  tool: string;
};

/** Copies text to the clipboard with visible + announced feedback; degrades to a message if the API is unavailable. */
export function CopyButton({ text, label, className = "", tool }: CopyButtonProps) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
      track("tool_output_copied", { tool });
    } catch {
      setState("failed");
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2500);
  }

  return (
    <>
      <button
        type="button"
        onClick={copy}
        className={`inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)] ${className}`}
      >
        {state === "copied" ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
        <span>{state === "copied" ? "Copied" : label}</span>
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {state === "copied" ? "Copied to clipboard" : state === "failed" ? "Copy failed. Select the text and copy it manually." : ""}
      </span>
      {state === "failed" ? <span className="text-sm text-[var(--muted)]">Copy is unavailable here; select the text and copy it manually.</span> : null}
    </>
  );
}
