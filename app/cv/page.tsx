import type { Metadata } from "next";
import { Download, GitBranch, Network, Star } from "lucide-react";
import { ButtonLink } from "@/components/button-link";
import { JsonLd } from "@/components/json-ld";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { education } from "@/data/education";
import { experience } from "@/data/experience";
import { expertiseGroups } from "@/data/expertise";
import { formatProfilePeriod, profile } from "@/data/profile";
import { site } from "@/data/site";
import { getFeaturedGitHubProjects } from "@/lib/projects";

export const metadata: Metadata = {
  title: "Professional CV",
  description: `Professional CV for ${site.name}, covering technical leadership, AI systems architecture, full-stack engineering, open source, and cloud delivery.`,
  alternates: { canonical: "/cv" },
  openGraph: {
    title: `${site.name} — Professional CV`,
    description: "Technical leadership, AI systems architecture, full-stack engineering, and open-source work.",
    url: "/cv",
    type: "profile"
  }
};

export default async function CvPage() {
  const projects = await getFeaturedGitHubProjects();
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
      sameAs: [site.linkedin, site.github]
    },
    hasPart: projects.map((project) => ({
      "@type": "SoftwareSourceCode",
      name: project.name,
      url: `${site.url}/projects/${project.repository}`,
      codeRepository: project.repositoryUrl
    }))
  };

  return (
    <main>
      <JsonLd data={jsonLd} />
      <SiteNav />
      <header className="border-b border-[var(--line)] bg-[var(--surface)]">
        <div className="mx-auto w-full max-w-5xl px-5 pb-14 pt-32 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent-dark)]">Professional CV</p>
          <h1 className="mt-4 font-display text-5xl leading-tight text-[var(--ink)] md:text-6xl">{site.name}</h1>
          <p className="mt-5 max-w-3xl text-xl leading-9 text-[var(--muted)]">{profile.identity.headline}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href={site.resume} variant="primary" icon={<Download size={16} />}>Download PDF</ButtonLink>
            <ButtonLink href={site.linkedin} icon={<Network size={16} />}>LinkedIn</ButtonLink>
            <ButtonLink href={site.github} icon={<GitBranch size={16} />}>GitHub</ButtonLink>
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
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{item.summary}</p>
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
              <article key={project.repository} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-semibold text-[var(--ink)]">
                    <a href={project.repositoryUrl} target="_blank" rel="noreferrer" className="hover:text-[var(--accent-dark)]">
                      {project.name}
                    </a>
                  </h3>
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--muted)]">
                    <Star size={15} aria-hidden /> {project.stars.toLocaleString()} stars
                  </span>
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
                <p className="text-sm font-semibold text-[var(--accent-dark)]">
                  {item.issuedDate ? formatProfilePeriod(item.issuedDate, item.expiresDate) : "Professional certification"}
                </p>
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
