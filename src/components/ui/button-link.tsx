"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { goalToEvent, type Goal, type TrackedEvent } from "@/features/telemetry/goals";
import { track } from "@/features/telemetry/client";

type ButtonVariant = "primary" | "secondary" | "ghost" | "onDarkPrimary" | "onDarkGhost";

type ButtonLinkProps = {
  href: string;
  children: ReactNode;
  icon?: ReactNode;
  variant?: ButtonVariant;
  className?: string;
  /** The site's call-to-action vocabulary; mapped to the typed taxonomy in lib/telemetry/goals.ts. */
  eventName?: Goal;
  /** An explicit typed event, for anything the vocabulary above cannot express (for example demo_click). */
  event?: TrackedEvent;
};

const variants: Record<ButtonVariant, string> = {
  primary: "border-[var(--ink)] bg-[var(--ink)] text-white hover:bg-[var(--cool)] hover:border-[var(--cool)]",
  secondary: "border-[var(--line)] bg-[var(--surface-strong)] text-[var(--ink)] hover:border-[var(--accent)]",
  ghost: "border-transparent bg-transparent text-[var(--muted)] hover:text-[var(--ink)]",
  onDarkPrimary: "border-white bg-white text-[var(--ink)] hover:border-[#f0c37b] hover:bg-[#f0c37b] active:border-[#f0c37b] active:bg-[#f0c37b] active:text-[var(--ink)] focus-visible:text-[var(--ink)]",
  onDarkGhost: "border-transparent bg-transparent text-white/72 hover:text-white active:text-white focus-visible:text-white"
};

export function ButtonLink({ href, children, icon, variant = "secondary", className = "", eventName, event }: ButtonLinkProps) {
  const pathname = usePathname() ?? "/";
  const onClick = () => {
    const tracked = event ?? (eventName ? goalToEvent(eventName, href, pathname) : null);
    if (tracked) track(tracked.name, tracked.props);
  };
  const classes = [
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]",
    variants[variant],
    className
  ].join(" ");
  const isExternal = href.startsWith("http");

  if (isExternal) {
    return (
      <a className={classes} href={href} target="_blank" rel="noreferrer" onClick={onClick}>
        {icon}
        <span>{children}</span>
      </a>
    );
  }

  if (href.startsWith("mailto:")) {
    return (
      <a className={classes} href={href} onClick={onClick}>
        {icon}
        <span>{children}</span>
      </a>
    );
  }

  return (
    <Link className={classes} href={href} onClick={onClick}>
      {icon}
      <span>{children}</span>
    </Link>
  );
}
