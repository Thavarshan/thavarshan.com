import { Download, GitBranch, Mail } from "lucide-react";
import { ButtonLink } from "@/components/button-link";
import { navigation, site } from "@/data/site";

export function SiteNav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[var(--line)] bg-[var(--surface)]/92 backdrop-blur">
      <nav aria-label="Primary navigation" className="mx-auto flex h-[72px] w-full max-w-6xl items-center justify-between gap-4 px-5 lg:px-8">
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
          <ButtonLink href={site.github} variant="ghost" className="hidden px-3 md:inline-flex" icon={<GitBranch size={16} />}>GitHub</ButtonLink>
          <ButtonLink href={site.emailHref} variant="secondary" className="px-3" icon={<Mail size={16} />}>Email</ButtonLink>
          <ButtonLink href={site.resume} variant="primary" className="px-3" icon={<Download size={16} />}>Resume</ButtonLink>
        </div>
      </nav>
    </header>
  );
}
