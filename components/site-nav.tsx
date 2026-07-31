"use client";

import { Download, GitBranch, Mail, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { ButtonLink } from "@/components/button-link";
import { navigation, site } from "@/data/site";

export function SiteNav() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen]);

  return (
    <header className="site-header fixed inset-x-0 top-0 z-50 border-b border-[var(--line)] bg-[var(--surface)]/92 backdrop-blur">
      <nav aria-label="Primary navigation" className="site-nav-inner mx-auto flex min-h-[72px] w-full max-w-6xl items-center justify-between gap-3 px-5 lg:px-8">
        <a href="/" className="min-w-0 text-sm font-bold text-[var(--ink)]">
          Jerome T.
        </a>
        <div className="hidden items-center gap-1 md:flex">
          {navigation.map((item) => (
            <a key={item.href} href={item.href} className="rounded-lg px-3 py-2 text-sm font-semibold text-[var(--muted)] transition hover:text-[var(--ink)]">
              {item.label}
            </a>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ButtonLink href={site.github} variant="ghost" className="hidden px-3 md:inline-flex" icon={<GitBranch size={16} />} eventName="GitHub Visit">GitHub</ButtonLink>
          <ButtonLink href={site.emailHref} variant="secondary" className="px-3 max-[374px]:px-2" icon={<Mail size={16} />} eventName="Contact">
            <span className="max-[374px]:sr-only">Email</span>
          </ButtonLink>
          <ButtonLink href={site.resume} variant="primary" className="px-3 max-[374px]:px-2" icon={<Download size={16} />} eventName="Resume Download">Resume</ButtonLink>
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-[var(--line)] text-[var(--ink)] transition hover:border-[var(--accent)] md:hidden"
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={19} aria-hidden /> : <Menu size={19} aria-hidden />}
          </button>
        </div>
      </nav>
      <div
        id="mobile-navigation"
        aria-hidden={!menuOpen}
        className={`mobile-navigation border-t border-[var(--line)] bg-[var(--surface)] px-5 py-4 md:hidden ${menuOpen ? "block" : "hidden"}`}
      >
        <div className="mx-auto grid w-full max-w-6xl gap-1">
          {navigation.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-semibold text-[var(--muted)] transition hover:bg-[var(--paper)] hover:text-[var(--ink)]"
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </a>
          ))}
          <a
            href={site.github}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[var(--muted)] transition hover:bg-[var(--paper)] hover:text-[var(--ink)]"
            onClick={() => setMenuOpen(false)}
          >
            <GitBranch size={16} aria-hidden /> GitHub
          </a>
        </div>
      </div>
    </header>
  );
}
