import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { site } from "@/data/site";

export const metadata: Metadata = {
  title: "Privacy",
  description: `Privacy notes for ${site.name}'s personal website, including cookie-free analytics and outbound-link behavior.`,
  alternates: { canonical: "/privacy" },
  robots: {
    index: true,
    follow: true
  }
};

export default function PrivacyPage() {
  return (
    <main>
      <SiteNav />
      <article className="mx-auto w-full max-w-3xl px-5 pb-20 pt-32 lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent-dark)]">Privacy</p>
        <h1 className="mt-4 font-display text-[clamp(2.5rem,11vw,3.75rem)] leading-tight text-balance text-[var(--ink)]">Privacy on this website</h1>
        <div className="mt-8 space-y-6 text-base leading-8 text-[var(--muted)]">
          <p>
            This personal website is designed to be light on data collection. It does not include a contact form, advertising pixels, or public phone-number capture.
          </p>
          <p>
            Traffic measurement uses Plausible Cloud, a privacy-respecting analytics service that does not use cookies for standard website analytics. The site tracks high-intent actions such as email clicks, resume downloads, outbound profile visits, repository visits, and article engagement so future content can be improved.
          </p>
          <p>
            External links to LinkedIn, GitHub, DEV Community, Stack Overflow, package registries, and project documentation may be governed by those services' own privacy policies.
          </p>
          <p>
            For professional enquiries, contact {site.email}.
          </p>
        </div>
      </article>
      <SiteFooter />
    </main>
  );
}
