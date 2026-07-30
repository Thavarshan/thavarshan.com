import type { Metadata } from "next";
import { ButtonLink } from "@/components/button-link";
import { ContactBand } from "@/components/contact-band";
import { InsightCard } from "@/components/insight-card";
import { JsonLd } from "@/components/json-ld";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { sameAsProfiles } from "@/data/external-profiles";
import { profile } from "@/data/profile";
import { site } from "@/data/site";
import { getAllInsights } from "@/lib/insights";
import { Download, Mail, Network } from "lucide-react";

export const metadata: Metadata = {
  title: "Engineering Insights",
  description: `First-hand technical writing by ${site.name} on AI workflows, platform engineering, architecture modernization, and developer tools.`,
  alternates: {
    canonical: "/insights",
    types: {
      "application/rss+xml": "/feed.xml"
    }
  },
  openGraph: {
    title: `${site.name} — Engineering Insights`,
    description: "Practical engineering notes on AI systems, platform modernization, and developer tooling.",
    url: "/insights",
    type: "website"
  }
};

export default function InsightsPage() {
  const insights = getAllInsights();
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${site.url}/insights#collection`,
        url: `${site.url}/insights`,
        name: `${site.name} — Engineering Insights`,
        description: metadata.description,
        author: { "@id": `${site.url}/#person` },
        hasPart: insights.map((insight) => ({
          "@type": "Article",
          headline: insight.title,
          url: `${site.url}/insights/${insight.slug}`,
          datePublished: insight.publishedAt,
          dateModified: insight.updatedAt ?? insight.publishedAt,
          author: { "@id": `${site.url}/#person` }
        }))
      },
      {
        "@type": "Person",
        "@id": `${site.url}/#person`,
        name: site.name,
        jobTitle: profile.identity.headline,
        sameAs: sameAsProfiles
      }
    ]
  };

  return (
    <main>
      <JsonLd data={jsonLd} />
      <SiteNav />
      <header className="border-b border-[var(--line)] bg-[var(--surface)]">
        <div className="mx-auto w-full max-w-6xl px-5 pb-14 pt-32 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent-dark)]">Insights</p>
          <h1 className="mt-4 max-w-4xl font-display text-5xl leading-tight text-[var(--ink)] md:text-7xl">
            Practical notes from building AI systems, platforms, and developer tools.
          </h1>
          <p className="mt-6 max-w-3xl text-xl leading-9 text-[var(--muted)]">
            A curated publication for first-hand engineering decisions, trade-offs, failures, architecture lessons, and reusable patterns.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href={site.emailHref} variant="primary" icon={<Mail size={16} />} eventName="Contact">Start a conversation</ButtonLink>
            <ButtonLink href={site.resume} icon={<Download size={16} />} eventName="Resume Download">View resume</ButtonLink>
            <ButtonLink href={site.linkedin} icon={<Network size={16} />} eventName="LinkedIn Visit">Connect on LinkedIn</ButtonLink>
          </div>
        </div>
      </header>
      <section aria-label="Published insights" className="mx-auto grid w-full max-w-6xl gap-5 px-5 py-16 md:grid-cols-2 lg:px-8">
        <h2 className="sr-only">Published insights</h2>
        {insights.map((insight) => (
          <InsightCard key={insight.slug} insight={insight} />
        ))}
      </section>
      <ContactBand />
      <SiteFooter />
    </main>
  );
}
