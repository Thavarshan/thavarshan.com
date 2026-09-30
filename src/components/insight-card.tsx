import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Insight } from "@/lib/insight-model";
import { getInsightUrl } from "@/lib/insights";

type InsightCardProps = {
  insight: Insight;
};

export function InsightCard({ insight }: InsightCardProps) {
  return (
    <article className="group relative h-full rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5 transition hover:-translate-y-0.5 hover:border-[var(--accent)] sm:p-6">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent-dark)]">
        {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(insight.publishedAt))}
        {" · "}
        {insight.readingTimeMinutes} min read
      </p>
      <h3 className="mt-4 break-anywhere text-xl font-semibold leading-snug text-[var(--ink)] sm:text-2xl">
        <Link href={getInsightUrl(insight.slug)} className="focus-visible:outline-none">
          <span className="absolute inset-0" aria-hidden />
          {insight.title}
        </Link>
      </h3>
      <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{insight.description}</p>
      <div className="mt-6 flex flex-wrap gap-2">
        {insight.topics.slice(0, 4).map((topic) => (
          <span key={topic} className="rounded-full border border-[var(--line)] bg-white px-3 py-1 text-xs font-medium text-[var(--cool)]">
            {topic}
          </span>
        ))}
      </div>
      <p className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
        Read insight <ArrowUpRight size={16} className="transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </p>
    </article>
  );
}
