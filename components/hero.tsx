import Image from "next/image";
import { ArrowDown, Download, Mail, Network } from "lucide-react";
import { ButtonLink } from "@/components/button-link";
import { getCurrentExperience, profile } from "@/data/profile";
import { site } from "@/data/site";

export function Hero() {
  const currentExperience = getCurrentExperience();

  return (
    <section className="relative border-b border-[var(--line)] bg-[var(--surface)]">
      <div className="mx-auto grid min-h-[calc(100svh-72px)] w-full max-w-6xl content-center gap-8 px-5 pb-14 pt-28 sm:gap-10 md:min-h-[720px] md:grid-cols-[1fr_220px] md:items-center md:pb-16 lg:px-8">
        <div className="max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent-dark)]">
            Technical leadership for AI workflows, scalable platforms, cloud architecture, and developer tooling
          </p>
          <h1 className="break-anywhere mt-5 font-display text-[clamp(2.75rem,13vw,4rem)] leading-[1.02] text-balance text-[var(--ink)] sm:text-6xl md:text-7xl">
            {site.name}
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-pretty text-[var(--muted)] sm:text-xl sm:leading-9">
            {profile.identity.headline}
          </p>
          <p className="mt-4 max-w-2xl text-sm font-semibold uppercase tracking-[0.14em] text-[var(--cool)]">
            Open to selected global technical-leadership conversations.
          </p>
          <p className="mt-5 max-w-2xl text-base leading-8 text-[var(--muted)]">
            {profile.summary}
          </p>
          <div className="mobile-stack-actions mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <ButtonLink href={site.emailHref} variant="primary" icon={<Mail size={16} />} eventName="Contact">Start a conversation</ButtonLink>
            <ButtonLink href={site.resume} icon={<Download size={16} />} eventName="Resume Download">View resume</ButtonLink>
            <ButtonLink href={site.linkedin} icon={<Network size={16} />} eventName="LinkedIn Visit">Connect on LinkedIn</ButtonLink>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-lg border border-[var(--line)] bg-[var(--paper)]/55 p-3 md:block md:border-0 md:bg-transparent md:p-0">
          <Image
            src={site.avatar}
            alt={site.name}
            width={176}
            height={176}
            priority
            unoptimized
            className="h-24 w-24 rounded-lg border border-[var(--line)] object-cover sm:h-28 sm:w-28 md:h-44 md:w-44"
          />
          <div className="max-w-[16rem] md:mt-5">
            <h2 className="text-sm font-semibold text-[var(--ink)]">{currentExperience.company}</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{currentExperience.summary}</p>
          </div>
        </div>
      </div>
      <a
        href="#projects"
        className="absolute bottom-5 left-1/2 hidden -translate-x-1/2 items-center gap-2 text-sm font-semibold text-[var(--muted)] transition hover:text-[var(--ink)] md:inline-flex"
      >
        Selected work
        <ArrowDown size={16} />
      </a>
    </section>
  );
}
