import type { ExperienceItem } from "@/data/experience";
import { Reveal } from "@/components/reveal";

type TimelineProps = {
  items: ExperienceItem[];
};

export function Timeline({ items }: TimelineProps) {
  return (
    <div className="relative">
      <div className="absolute left-3 top-0 h-full w-px bg-[var(--line)] md:left-[9.5rem]" aria-hidden />
      <div className="space-y-8">
        {items.map((item, index) => (
          <Reveal key={`${item.company}-${item.period}`} delay={index * 0.03}>
            <article className="relative grid gap-4 pl-10 md:grid-cols-[8rem_1fr] md:gap-8 md:pl-0">
              <div className="absolute left-[0.45rem] top-2 h-3 w-3 rounded-full border-2 border-[var(--surface)] bg-[var(--accent)] md:left-[9.1rem]" aria-hidden />
              <p className="text-sm font-semibold text-[var(--accent-dark)] md:text-right">{item.period}</p>
              <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6">
                <h3 className="break-anywhere text-xl font-semibold text-[var(--ink)]">{item.role}</h3>
                <p className="mt-1 text-sm font-medium text-[var(--cool)]">{item.company}</p>
                <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{item.summary}</p>
                {item.highlights.length > 0 ? (
                  <ul className="mt-5 space-y-2 text-sm leading-6 text-[var(--ink)]">
                    {item.highlights.map((highlight) => (
                      <li key={highlight} className="flex gap-2">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" aria-hidden />
                        <span>{highlight}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
