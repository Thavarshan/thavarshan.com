import type { ReactNode } from "react";
import { Reveal } from "@/components/reveal";

type SectionProps = {
  id: string;
  title?: string;
  eyebrow?: string;
  intro?: string;
  ariaLabel?: string;
  children: ReactNode;
};

export function Section({ id, title, eyebrow, intro, ariaLabel, children }: SectionProps) {
  return (
    <section id={id} aria-label={ariaLabel} className="mx-auto w-full max-w-6xl px-5 py-16 md:py-24 lg:px-8">
      {title ? (
        <Reveal>
          <div className="mb-10 max-w-3xl">
            {eyebrow ? <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent-dark)]">{eyebrow}</p> : null}
            <h2 className="mt-4 font-display text-4xl leading-tight text-balance text-[var(--ink)] md:text-5xl">{title}</h2>
            {intro ? <p className="mt-5 text-base leading-8 text-pretty text-[var(--muted)]">{intro}</p> : null}
          </div>
        </Reveal>
      ) : null}
      {children}
    </section>
  );
}
