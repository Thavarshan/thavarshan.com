import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import { JsonLd } from "@/components/ui/json-ld";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteNav } from "@/components/layout/site-nav";
import { site } from "@/features/profile/site";
import { toolUrl, tools } from "@/features/tools/registry";

export const metadata: Metadata = {
  title: "Free Laravel & PHP Developer Tools",
  description: "Small, private, browser-only tools for Laravel and PHP developers: a scheduler cron helper and a .env checker. No sign-in, no uploads.",
  alternates: { canonical: "/tools" },
  openGraph: {
    title: `${site.name} — Free Laravel & PHP Developer Tools`,
    description: "Private, browser-only utilities for Laravel and PHP developers.",
    url: "/tools",
    type: "website"
  }
};

export default function ToolsPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${site.url}/tools#collection`,
        url: `${site.url}/tools`,
        name: `${site.name} — Free Laravel & PHP Developer Tools`,
        description: metadata.description,
        author: { "@id": `${site.url}/#person` },
        hasPart: tools.map((tool) => ({ "@type": "WebApplication", name: tool.name, url: toolUrl(tool.slug), description: tool.description }))
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: site.url },
          { "@type": "ListItem", position: 2, name: "Tools", item: `${site.url}/tools` }
        ]
      }
    ]
  };

  return (
    <main>
      <JsonLd data={jsonLd} />
      <SiteNav />
      <header className="border-b border-[var(--line)] bg-[var(--surface)]">
        <div className="mx-auto w-full max-w-6xl px-5 pb-14 pt-32 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent-dark)]">Developer tools</p>
          <h1 className="mt-4 max-w-4xl font-display text-[clamp(2.5rem,11vw,4rem)] leading-tight text-balance text-[var(--ink)] md:text-7xl">
            Small, private tools for Laravel and PHP developers.
          </h1>
          <p className="mt-6 max-w-3xl text-xl leading-9 text-[var(--muted)]">
            Utilities I wanted while shipping Laravel systems: deterministic, explained, and run entirely in your browser. No sign-in, no uploads, no tracking of what you type.
          </p>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-5 py-12 lg:px-8">
        <ul className="grid gap-6 md:grid-cols-2">
          {tools.map((tool) => (
            <li key={tool.slug} className="flex flex-col rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6">
              <h2 className="font-display text-2xl text-[var(--ink)]">{tool.name}</h2>
              <p className="mt-3 leading-7 text-[var(--muted)]">{tool.description}</p>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]"><strong className="text-[var(--ink)]">Best for:</strong> {tool.audience.replaceAll("`", "")}</p>
              <Link href={`/tools/${tool.slug}`} className="mt-5 inline-flex min-h-11 items-center gap-2 self-start font-semibold text-[var(--accent-dark)] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]">
                Open the tool <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>

        <section aria-labelledby="principles" className="mt-14 max-w-3xl">
          <h2 id="principles" className="font-display text-3xl text-[var(--ink)]">How these tools are built</h2>
          <ul className="mt-4 grid gap-3 text-lg leading-8 text-[var(--muted)]">
            <li className="list-disc ml-6"><Lock size={16} className="mr-1 inline" aria-hidden="true" />Everything runs client-side. Inputs, including anything that looks like a secret, are never sent to a server.</li>
            <li className="list-disc ml-6">Deterministic and tested: no AI guesses. Suggestions are only shown when they are provably equivalent, and limits are documented on each page.</li>
            <li className="list-disc ml-6">Deliberately few. Each tool exists because it solves a recurring Laravel problem well, not to fill a keyword list.</li>
          </ul>
        </section>
      </div>
      <SiteFooter />
    </main>
  );
}
