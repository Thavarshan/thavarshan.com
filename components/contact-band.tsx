import { ArrowUpRight, GitBranch, Mail, Network } from "lucide-react";
import { ButtonLink } from "@/components/button-link";
import { site } from "@/data/site";

export function ContactBand() {
  return (
    <section id="contact" aria-labelledby="contact-title" className="border-y border-[var(--line)] bg-[var(--ink)] text-white">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-5 py-16 md:grid-cols-[1fr_auto] md:items-end lg:px-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#f0c37b]">Contact</p>
          <h2 id="contact-title" className="mt-4 max-w-3xl font-display text-4xl leading-tight text-balance md:text-5xl">
            Building senior engineering teams, AI workflows, or developer platforms?
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-8 text-white/72">
            I am open to focused conversations around technical leadership, full-stack architecture, and useful product work.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={site.emailHref} variant="onDarkPrimary" icon={<Mail size={16} />}>
            Email
          </ButtonLink>
          <ButtonLink href={site.linkedin} variant="onDarkGhost" icon={<Network size={16} />}>
            LinkedIn
          </ButtonLink>
          <ButtonLink href={site.github} variant="onDarkGhost" icon={<GitBranch size={16} />}>
            GitHub
          </ButtonLink>
          <ButtonLink href={site.resume} variant="onDarkGhost" icon={<ArrowUpRight size={16} />}>
            Resume
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
