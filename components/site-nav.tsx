"use client";

import { Download, GitBranch, Mail, Menu, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ButtonLink } from "@/components/button-link";
import { navigation, site } from "@/data/site";

const DESKTOP_QUERY = "(min-width: 1024px)";

export function SiteNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback((returnFocus = false) => {
    setMenuOpen(false);
    if (returnFocus) toggleRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu(true);
    };

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || toggleRef.current?.contains(target)) return;
      closeMenu();
    };

    const desktop = window.matchMedia(DESKTOP_QUERY);
    const handleBreakpoint = () => {
      if (desktop.matches) closeMenu();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    desktop.addEventListener("change", handleBreakpoint);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
      desktop.removeEventListener("change", handleBreakpoint);
    };
  }, [closeMenu, menuOpen]);

  return (
    <>
      <header className="site-header fixed inset-x-0 top-0 z-50 border-b border-[var(--line)] bg-[var(--surface)]/92 backdrop-blur">
        <nav aria-label="Primary navigation" className="site-nav-inner mx-auto flex min-h-[72px] w-full max-w-6xl items-center justify-between gap-2 px-4 sm:gap-3 sm:px-5 lg:px-8">
          <a href="/" className="shrink-0 whitespace-nowrap text-sm font-bold text-[var(--ink)]">
            Jerome T.
          </a>
          <div className="hidden min-w-0 items-center gap-1 lg:flex">
            {navigation.map((item) => (
              <a key={item.href} href={item.href} className="whitespace-nowrap rounded-lg px-2.5 py-2 text-sm font-semibold text-[var(--muted)] transition hover:text-[var(--ink)] xl:px-3">
                {item.label}
              </a>
            ))}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {/* Wrappers use `contents` so the buttons stay direct flex children when shown.
                Putting `hidden` on ButtonLink itself loses to its own base `inline-flex`. */}
            <span className="hidden xl:contents">
              <ButtonLink href={site.github} variant="ghost" className="px-3" icon={<GitBranch size={16} />} eventName="GitHub Visit">GitHub</ButtonLink>
            </span>
            <span className="hidden sm:contents">
              <ButtonLink href={site.emailHref} variant="secondary" className="px-3" icon={<Mail size={16} />} eventName="Contact">Email</ButtonLink>
              <ButtonLink href={site.resume} variant="primary" className="px-3" icon={<Download size={16} />} eventName="Resume Download">Resume</ButtonLink>
            </span>
            <button
              ref={toggleRef}
              type="button"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[var(--line)] text-[var(--ink)] transition hover:border-[var(--accent)] lg:hidden"
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
          ref={panelRef}
          id="mobile-navigation"
          aria-hidden={!menuOpen}
          data-state={menuOpen ? "open" : "closed"}
          className={`mobile-navigation border-t border-[var(--line)] bg-[var(--surface)] lg:hidden ${menuOpen ? "block" : "hidden"}`}
        >
          <div className="mx-auto w-full max-w-6xl px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 sm:px-5">
            <div className="grid gap-0.5 sm:grid-cols-2 md:grid-cols-3">
              {navigation.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="flex min-h-12 items-center rounded-lg px-3 text-base font-semibold text-[var(--muted)] transition hover:bg-[var(--paper)] hover:text-[var(--ink)]"
                  onClick={() => closeMenu()}
                >
                  {item.label}
                </a>
              ))}
            </div>
            <div className="mt-3 grid gap-2 border-t border-[var(--line)] pt-3 sm:grid-cols-2 md:grid-cols-3">
              <ButtonLink href={site.emailHref} variant="secondary" className="w-full sm:hidden" icon={<Mail size={16} />} eventName="Contact">Email</ButtonLink>
              <ButtonLink href={site.resume} variant="primary" className="w-full sm:hidden" icon={<Download size={16} />} eventName="Resume Download">Resume</ButtonLink>
              <ButtonLink href={site.github} variant="secondary" className="w-full" icon={<GitBranch size={16} />} eventName="GitHub Visit">GitHub</ButtonLink>
            </div>
          </div>
        </div>
      </header>
      <button
        type="button"
        tabIndex={-1}
        aria-hidden
        onClick={() => closeMenu()}
        className={`mobile-navigation-backdrop fixed inset-0 z-40 cursor-default bg-[var(--ink)]/25 lg:hidden ${menuOpen ? "block" : "hidden"}`}
      />
    </>
  );
}
