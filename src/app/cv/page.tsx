import type { Metadata } from "next";
import { Download, Mail, Network } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";
import { JsonLd } from "@/components/ui/json-ld";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteNav } from "@/components/layout/site-nav";
import { education } from "@/features/profile/education";
import { experience } from "@/features/profile/experience";
import { expertiseGroups } from "@/features/profile/expertise";
import { sameAsProfiles } from "@/features/profile/external-profiles";
import { formatProfilePeriod, profile } from "@/features/profile/profile";
import { site } from "@/features/profile/site";

export const metadata: Metadata = {
  title: "Professional CV",
  description: `Professional CV for ${site.name}: technical leadership, full-stack engineering, and generative AI systems.`,
  alternates: { canonical: "/cv" },
  openGraph: {
    images: [{ url: "/images/Banner.jpg", width: 1200, height: 630, alt: site.name }],
    title: `${site.name} — Professional CV`,
    description: "Technical leadership, full-stack engineering, generative AI, and open-source work.",
    url: "/cv",
    type: "profile"
  }
};

export default function CvPage() {
  const projects = profile.resumeProjects ?? [];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${site.url}/cv#webpage`,
    url: `${site.url}/cv`,
    name: `${site.name} — Professional CV`,
    dateModified: profile.modifiedAt,
    about: {
      "@type": "Person",
      "@id": `${site.url}/#person`,
      name: site.name,
      jobTitle: profile.identity.headline,
      sameAs: sameAsProfiles
    },
    hasPart: projects.map((project) => ({
      "@type": "SoftwareSourceCode",
      name: project.name,
      url: project.url ?? project.links?.[0]?.url ?? site.url,
      codeRepository: project.url ?? project.links?.[0]?.url ?? site.url
    }))
  };

  return (
    <main>
      <JsonLd data={jsonLd} />
      <SiteNav />
      <header className="border-b border-[var(--line)] bg-[var(--surface)]">
        <div className="mx-auto w-full max-w-5xl px-5 pb-14 pt-32 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent-dark)]">Professional CV</p>
          <h1 className="mt-4 break-anywhere font-display text-[clamp(2.5rem,11vw,3.75rem)] leading-tight text-[var(--ink)] md:text-6xl">{site.name}</h1>
          <p className="mt-5 max-w-3xl text-xl leading-9 text-[var(--muted)]">{profile.identity.headline}</p>
          {profile.identity.specialtyLine ? <p className="mt-2 max-w-3xl text-sm font-medium leading-7 text-[var(--cool)]">{profile.identity.specialtyLine}</p> : null}
          <p className="mt-3 text-sm text-[var(--muted)]">
            {profile.identity.location}{profile.identity.availability ? ` · ${profile.identity.availability}` : ""}
          </p>
          {profile.identity.phone ? (
            <p className="mt-2 text-sm text-[var(--muted)]">
              <a href={`tel:${profile.identity.phone.replace(/\s+/g, "")}`} className="hover:text-[var(--accent-dark)]">{profile.identity.phone}</a>
              {" · "}<a href={site.emailHref} className="hover:text-[var(--accent-dark)]">{profile.identity.email}</a>
            </p>
          ) : null}
          <div className="mobile-stack-actions mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <ButtonLink href={site.emailHref} variant="primary" icon={<Mail size={16} />} eventName="Contact">Start a conversation</ButtonLink>
            <ButtonLink href={site.resume} icon={<Download size={16} />} eventName="Resume Download">View resume</ButtonLink>
            <ButtonLink href={site.linkedin} icon={<Network size={16} />} eventName="LinkedIn Visit">Connect on LinkedIn</ButtonLink>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl space-y-16 px-5 py-16 lg:px-8">
        <section aria-labelledby="cv-summary">
          <h2 id="cv-summary" className="font-display text-3xl text-[var(--ink)]">Professional summary</h2>
          <p className="mt-5 max-w-4xl text-base leading-8 text-[var(--muted)]">{profile.summary}</p>
        </section>

        <section aria-labelledby="cv-experience">
          <h2 id="cv-experience" className="font-display text-3xl text-[var(--ink)]">Experience</h2>
          <div className="mt-8 space-y-8">
            {experience.map((item) => (
              <article key={`${item.company}-${item.period}`} className="border-l-2 border-[var(--accent)] pl-5">
                <p className="text-sm font-semibold text-[var(--accent-dark)]">{item.period}</p>
                <h3 className="mt-2 text-xl font-semibold text-[var(--ink)]">{item.role}</h3>
                <p className="mt-1 text-sm font-medium text-[var(--cool)]">{item.company}</p>
                {item.summary && item.highlights.length === 0 ? <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{item.summary}</p> : null}
                {item.highlights.length ? (
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-7 text-[var(--ink)]">
                    {item.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}
                  </ul>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="cv-expertise">
          <h2 id="cv-expertise" className="font-display text-3xl text-[var(--ink)]">Core expertise</h2>
          <div className="mt-7 grid gap-4 md:grid-cols-2">
            {expertiseGroups.map((group) => (
              <article key={group.title} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5">
                <h3 className="font-semibold text-[var(--ink)]">{group.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{group.items.join(" · ")}</p>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="cv-open-source">
          <h2 id="cv-open-source" className="font-display text-3xl text-[var(--ink)]">Selected open-source work</h2>
          <div className="mt-7 space-y-4">
            {projects.map((project) => (
              <article key={project.id} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-semibold text-[var(--ink)]">
                    {project.links?.length ? (
                      project.links.map((link, index) => (
                        <span key={link.url}>
                          {index > 0 ? " and " : ""}
                          <a href={link.url} target="_blank" rel="noreferrer" className="hover:text-[var(--accent-dark)]">{link.label}</a>
                        </span>
                      ))
                    ) : project.url ? (
                      <a href={project.url} target="_blank" rel="noreferrer" className="hover:text-[var(--accent-dark)]">{project.name}</a>
                    ) : project.name}
                  </h3>
                  <span className="text-sm font-semibold text-[var(--muted)]">{project.role}</span>
                </div>
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{project.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="cv-education">
          <h2 id="cv-education" className="font-display text-3xl text-[var(--ink)]">Education and credentials</h2>
          <div className="mt-7 grid gap-4 md:grid-cols-2">
            {education.map((item) => (
              <article key={item.institution} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5">
                <p className="text-sm font-semibold text-[var(--accent-dark)]">{item.period}</p>
                <h3 className="mt-2 font-semibold text-[var(--ink)]">{item.qualification}</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">{item.institution}</p>
              </article>
            ))}
            {profile.certifications.map((item) => (
              <article key={item.id} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5">
                {item.issuedDate ? <p className="text-sm font-semibold text-[var(--accent-dark)]">{formatProfilePeriod(item.issuedDate, item.expiresDate)}</p> : null}
                <h3 className="mt-2 font-semibold text-[var(--ink)]">{item.name}</h3>
                {item.authority ? <p className="mt-1 text-sm text-[var(--muted)]">{item.authority}</p> : null}
              </article>
            ))}
          </div>
        </section>

        {profile.languages.length ? (
          <section aria-labelledby="cv-languages">
            <h2 id="cv-languages" className="font-display text-3xl text-[var(--ink)]">Languages</h2>
            <p className="mt-5 text-base leading-8 text-[var(--muted)]">
              {profile.languages.map((language) => `${language.name}${language.proficiency ? ` — ${language.proficiency}` : ""}`).join(" · ")}
            </p>
          </section>
        ) : null}
      </div>
      <SiteFooter />
    </main>
  );
}
