import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { JsonLd } from "@/components/ui/json-ld";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteNav } from "@/components/layout/site-nav";
import { CronTool } from "@/features/tools/components/cron-tool";
import { EnvTool } from "@/features/tools/components/env-tool";
import { sameAsProfiles } from "@/features/profile/external-profiles";
import { profile } from "@/features/profile/profile";
import { site } from "@/features/profile/site";
import { getTool, toolUrl, tools } from "@/features/tools/registry";

type ToolPageProps = { params: Promise<{ slug: string }> };

const toolComponents: Record<string, () => React.JSX.Element> = {
  "laravel-scheduler-cron": CronTool,
  "laravel-env-checker": EnvTool
};

export function generateStaticParams() {
  return tools.map((tool) => ({ slug: tool.slug }));
}

export async function generateMetadata({ params }: ToolPageProps): Promise<Metadata> {
  const { slug } = await params;
  const tool = getTool(slug);
  if (!tool) return {};

  return {
    title: tool.title,
    description: tool.description,
    alternates: { canonical: `/tools/${tool.slug}` },
    openGraph: { title: tool.title, description: tool.description, url: `/tools/${tool.slug}`, type: "website" },
    twitter: { card: "summary_large_image", title: tool.title, description: tool.description }
  };
}

export default async function ToolPage({ params }: ToolPageProps) {
  const { slug } = await params;
  const tool = getTool(slug);
  const Tool = toolComponents[slug];
  if (!tool || !Tool) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        "@id": `${toolUrl(tool.slug)}#app`,
        name: tool.name,
        url: toolUrl(tool.slug),
        description: tool.description,
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Any (web browser)",
        browserRequirements: "Requires JavaScript",
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        datePublished: tool.datePublished,
        dateModified: tool.dateModified,
        author: { "@id": `${site.url}/#person` }
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: site.url },
          { "@type": "ListItem", position: 2, name: "Tools", item: `${site.url}/tools` },
          { "@type": "ListItem", position: 3, name: tool.name, item: toolUrl(tool.slug) }
        ]
      },
      { "@type": "Person", "@id": `${site.url}/#person`, name: site.name, jobTitle: profile.identity.headline, sameAs: sameAsProfiles }
    ]
  };

  return (
    <main>
      <JsonLd data={jsonLd} />
      <SiteNav />
      <header className="border-b border-[var(--line)] bg-[var(--surface)]">
        <div className="mx-auto w-full max-w-6xl px-5 pb-10 pt-32 lg:px-8">
          <Link href="/tools" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--accent-dark)] underline-offset-4 hover:underline">
            <ArrowLeft size={16} aria-hidden="true" /> All tools
          </Link>
          <h1 className="mt-4 max-w-4xl font-display text-[clamp(2.25rem,9vw,3.5rem)] leading-tight text-balance text-[var(--ink)]">{tool.h1}</h1>
          <p className="mt-5 max-w-3xl text-xl leading-9 text-[var(--muted)]">{tool.description}</p>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-5 py-10 lg:px-8">
        <Tool />

        <div className="mt-14 grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[2fr_1fr]">
          <div className="grid grid-cols-[minmax(0,1fr)] gap-12">
            <section aria-labelledby="about">
              <h2 id="about" className="font-display text-3xl text-[var(--ink)]">Why this exists</h2>
              {tool.intro.map((paragraph) => <p key={paragraph} className="mt-4 text-lg leading-8 text-[var(--muted)]">{paragraph}</p>)}
            </section>

            <section aria-labelledby="how">
              <h2 id="how" className="font-display text-3xl text-[var(--ink)]">How it works</h2>
              <ul className="mt-4 grid gap-3 text-lg leading-8 text-[var(--muted)]">
                {tool.howItWorks.map((item) => <li key={item} className="list-disc ml-6">{item}</li>)}
              </ul>
            </section>

            <section aria-labelledby="examples">
              <h2 id="examples" className="font-display text-3xl text-[var(--ink)]">Examples</h2>
              <dl className="mt-4 grid gap-4">
                {tool.examples.map((example) => (
                  <div key={example.title} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
                    <dt className="font-semibold text-[var(--ink)]">{example.title}</dt>
                    <dd className="mt-1 font-mono text-sm leading-6 text-[var(--muted)]">{example.body}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section aria-labelledby="limits">
              <h2 id="limits" className="font-display text-3xl text-[var(--ink)]">Limitations</h2>
              <ul className="mt-4 grid gap-3 text-lg leading-8 text-[var(--muted)]">
                {tool.limitations.map((item) => <li key={item} className="list-disc ml-6">{item}</li>)}
              </ul>
            </section>

            <section aria-labelledby="privacy">
              <h2 id="privacy" className="font-display text-3xl text-[var(--ink)]">Privacy</h2>
              <p className="mt-4 text-lg leading-8 text-[var(--muted)]">{tool.privacy}</p>
              <p className="mt-3 text-sm text-[var(--muted)]">Site-wide, this website uses cookie-free analytics that count page views and button clicks only. See the <Link className="underline underline-offset-4" href="/privacy">privacy notes</Link>.</p>
            </section>

            <section aria-labelledby="faq">
              <h2 id="faq" className="font-display text-3xl text-[var(--ink)]">Frequently asked questions</h2>
              <div className="mt-4 grid gap-3">
                {tool.faq.map((item) => (
                  <details key={item.question} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
                    <summary className="cursor-pointer font-semibold text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]">{item.question}</summary>
                    <p className="mt-3 leading-7 text-[var(--muted)]">{item.answer}</p>
                  </details>
                ))}
              </div>
            </section>
          </div>

          <aside aria-labelledby="related" className="lg:pt-2">
            <h2 id="related" className="font-display text-2xl text-[var(--ink)]">Related engineering work</h2>
            <ul className="mt-4 grid gap-4">
              {tool.related.map((link) => (
                <li key={link.href} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
                  <Link href={link.href} className="font-semibold text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4 hover:decoration-[var(--accent)]">{link.label}</Link>
                  <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{link.note}</p>
                </li>
              ))}
              <li className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
                <Link href="/tools" className="font-semibold text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4 hover:decoration-[var(--accent)]">More developer tools</Link>
                <p className="mt-1 text-sm leading-6 text-[var(--muted)]">Free, private, browser-only utilities for Laravel and PHP developers.</p>
              </li>
            </ul>
          </aside>
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}
