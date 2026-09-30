import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { site } from "@/data/site";

export const metadata: Metadata = {
  title: "Privacy",
  description: `Privacy notes for ${site.name}'s personal website, including cookie-free measurement and outbound-link behavior.`,
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
            To learn which of my work is useful, the site counts a small set of actions: clicking through to a repository or demo, opening the CV, using the contact links, using one of the developer tools, copying a tool&apos;s output, visiting a profile, and reading most of an article. Each count is stored as a daily total together with the page it happened on and how the visit arrived (the campaign tag in a link, or a broad category such as search, social, code or direct). The site does not record page views or who did what.
          </p>
          <p>
            What is <strong>not</strong> collected: IP addresses, user agents, cookies, any visitor or session identifier, fingerprints, exact timestamps, or anything you type. The developer tools run entirely in your browser; what you paste into them is never sent anywhere and is not part of these counts. The counts are kept for about thirteen months, then deleted automatically.
          </p>
          <p>
            If your browser sends Do Not Track or Global Privacy Control, the site sends nothing. Blocking scripts or requests is also fine: nothing on the site depends on these counts. The collector is a small first-party service on Cloudflare&apos;s free plan; your browser talks to it only when one of the actions above happens. Plausible Cloud is supported as an optional extra sink but is only active if it has been configured for the deployment.
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
