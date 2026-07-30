import type { Metadata } from "next";
import { Download, Mail, Network } from "lucide-react";
import { ButtonLink } from "@/components/button-link";
import { JsonLd } from "@/components/json-ld";
import { ProjectCard } from "@/components/project-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { site } from "@/data/site";
import { getFeaturedProjects } from "@/lib/projects";

export const metadata: Metadata = {
  title: "Open-Source Projects",
  description: `Selected open-source projects by ${site.name}, ranked by current GitHub adoption and covering PHP, TypeScript, developer tooling, HTTP, and concurrency.`,
  alternates: { canonical: "/projects" },
  openGraph: {
    title: `${site.name} — Open-Source Projects`,
    description: "Developer tools and open-source libraries with measurable community adoption.",
    url: "/projects",
    type: "website"
  }
};

export default async function ProjectsPage() {
  const projects = await getFeaturedProjects();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    url: `${site.url}/projects`,
    name: `${site.name} — Open-Source Projects`,
    hasPart: projects.map((project) => ({
      "@type": "SoftwareSourceCode",
      name: project.name,
      url: `${site.url}/projects/${project.repository}`,
      codeRepository: project.stats?.url
    }))
  };

  return (
    <main>
      <JsonLd data={jsonLd} />
      <SiteNav />
      <header className="border-b border-[var(--line)] bg-[var(--surface)]">
        <div className="mx-auto w-full max-w-6xl px-5 pb-14 pt-32 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent-dark)]">Open source</p>
          <h1 className="mt-4 max-w-4xl font-display text-5xl leading-tight text-[var(--ink)] md:text-6xl">
            Developer tools with measurable adoption.
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-[var(--muted)]">
            These projects are selected automatically from public, maintained GitHub repositories and ranked by current stars.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href={site.emailHref} variant="primary" icon={<Mail size={16} />} eventName="Contact">Start a conversation</ButtonLink>
            <ButtonLink href={site.resume} icon={<Download size={16} />} eventName="Resume Download">View resume</ButtonLink>
            <ButtonLink href={site.linkedin} icon={<Network size={16} />} eventName="LinkedIn Visit">Connect on LinkedIn</ButtonLink>
          </div>
        </div>
      </header>
      <section aria-label="Featured repositories" className="mx-auto grid w-full max-w-6xl gap-5 px-5 py-16 lg:grid-cols-2 lg:px-8">
        <h2 className="sr-only">Featured repositories</h2>
        {projects.map((project) => (
          <ProjectCard key={project.repository} project={project} detailsHref={`/projects/${project.repository}`} />
        ))}
      </section>
      <SiteFooter />
    </main>
  );
}
