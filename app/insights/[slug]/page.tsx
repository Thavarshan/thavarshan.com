import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, Mail, Network } from "lucide-react";
import { ButtonLink } from "@/components/button-link";
import { InsightEngagement } from "@/components/insight-engagement";
import { InsightCard } from "@/components/insight-card";
import { JsonLd } from "@/components/json-ld";
import { MarkdownContent } from "@/components/markdown-content";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { sameAsProfiles } from "@/data/external-profiles";
import { profile } from "@/data/profile";
import { site } from "@/data/site";
import { getAllInsights, getInsightBySlug, getInsightUrl } from "@/lib/insights";

type InsightPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return getAllInsights().map((insight) => ({ slug: insight.slug }));
}

export async function generateMetadata({ params }: InsightPageProps): Promise<Metadata> {
  const { slug } = await params;
  const insight = getInsightBySlug(slug);
  if (!insight) {
    return {};
  }

  return {
    title: insight.title,
    description: insight.description,
    alternates: { canonical: getInsightUrl(insight.slug) },
    openGraph: {
      title: insight.title,
      description: insight.description,
      url: getInsightUrl(insight.slug),
      type: "article",
      publishedTime: insight.publishedAt,
      modifiedTime: insight.updatedAt ?? insight.publishedAt,
      authors: [site.url]
    },
    twitter: {
      card: "summary_large_image",
      title: insight.title,
      description: insight.description
    }
  };
}

export default async function InsightPage({ params }: InsightPageProps) {
  const { slug } = await params;
  const insight = getInsightBySlug(slug);
  if (!insight) {
    notFound();
  }

  const relatedInsights = getAllInsights()
    .filter((item) => item.slug !== insight.slug && item.topics.some((topic) => insight.topics.includes(topic)))
    .slice(0, 2);
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${site.url}/insights/${insight.slug}#article`,
        url: `${site.url}/insights/${insight.slug}`,
        headline: insight.title,
        description: insight.description,
        datePublished: insight.publishedAt,
        dateModified: insight.updatedAt ?? insight.publishedAt,
        author: { "@id": `${site.url}/#person` },
        publisher: { "@id": `${site.url}/#website` },
        mainEntityOfPage: `${site.url}/insights/${insight.slug}`,
        articleSection: insight.topics,
        keywords: insight.topics.join(", "),
        image: `${site.url}/insights/${insight.slug}/opengraph-image`
      },
      {
        "@type": "Person",
        "@id": `${site.url}/#person`,
        name: site.name,
        jobTitle: profile.identity.headline,
        sameAs: sameAsProfiles
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: site.url },
          { "@type": "ListItem", position: 2, name: "Insights", item: `${site.url}/insights` },
          { "@type": "ListItem", position: 3, name: insight.title, item: `${site.url}/insights/${insight.slug}` }
        ]
      }
    ]
  };

  return (
    <main>
      <JsonLd data={jsonLd} />
      <InsightEngagement slug={insight.slug} />
      <SiteNav />
      <article>
        <header className="border-b border-[var(--line)] bg-[var(--surface)]">
          <div className="mx-auto w-full max-w-4xl px-5 pb-14 pt-32 lg:px-8">
            <Link href="/insights" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)]">
              <ArrowLeft size={16} /> All insights
            </Link>
            <p className="mt-10 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent-dark)]">
              {new Intl.DateTimeFormat("en", { dateStyle: "long", timeZone: "UTC" }).format(new Date(insight.publishedAt))}
              {" · "}
              {insight.readingTimeMinutes} min read
            </p>
            <h1 className="mt-4 font-display text-5xl leading-tight text-[var(--ink)] md:text-7xl">{insight.title}</h1>
            <p className="mt-6 text-xl leading-9 text-[var(--muted)]">{insight.description}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href={site.emailHref} variant="primary" icon={<Mail size={16} />} eventName="Contact">Start a conversation</ButtonLink>
              <ButtonLink href={site.resume} icon={<Download size={16} />} eventName="Resume Download">View resume</ButtonLink>
              <ButtonLink href={site.linkedin} icon={<Network size={16} />} eventName="LinkedIn Visit">Connect on LinkedIn</ButtonLink>
            </div>
          </div>
        </header>
        <div className="mx-auto w-full max-w-4xl px-5 py-16 lg:px-8">
          <MarkdownContent blocks={insight.blocks} />
        </div>
      </article>
      {relatedInsights.length ? (
        <section aria-labelledby="related-insights" className="mx-auto w-full max-w-6xl px-5 pb-16 lg:px-8">
          <h2 id="related-insights" className="font-display text-3xl text-[var(--ink)]">Related insights</h2>
          <div className="mt-7 grid gap-4 md:grid-cols-2">
            {relatedInsights.map((item) => (
              <InsightCard key={item.slug} insight={item} />
            ))}
          </div>
        </section>
      ) : null}
      <SiteFooter />
    </main>
  );
}
