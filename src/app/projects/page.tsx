import type { Metadata } from "next";
import { Download, Mail, Network } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";
import { JsonLd } from "@/components/ui/json-ld";
import { ProjectCard } from "@/features/projects/project-card";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteNav } from "@/components/layout/site-nav";
import { site } from "@/features/profile/site";
import { getFeaturedProjects } from "@/features/projects/projects";

export const metadata: Metadata = {
  title: "Selected Engineering Projects",
  description: `Selected public work by ${site.name}, including TypeScript/Electron product engineering, a Python document-analysis CLI, and maintained PHP developer libraries. Repository adoption figures refresh from GitHub.`,
  alternates: { canonical: "/projects" },
  openGraph: {
    images: [{ url: "/images/Banner.jpg", width: 1200, height: 630, alt: site.name }],
    title: `${site.name} — Selected Engineering Projects`,
    description: "Product engineering, Python tooling, and open-source libraries across multiple stacks.",
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
    name: `${site.name} — Selected Engineering Projects`,
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
          <h1 className="mt-4 max-w-4xl font-display text-[clamp(2.5rem,11vw,3.75rem)] leading-tight text-balance text-[var(--ink)] md:text-6xl">
            Product engineering and open-source work across multiple stacks.
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-[var(--muted)]">
            The list pairs current GitHub adoption data with selected cross-stack work, including a Python CLI and maintained PHP libraries.
          </p>
          <div className="mobile-stack-actions mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <ButtonLink href={site.emailHref} variant="primary" icon={<Mail size={16} />} eventName="Contact">
              Start a conversation
            </ButtonLink>
            <ButtonLink href={site.resume} icon={<Download size={16} />} eventName="Resume Download">
              View resume
            </ButtonLink>
            <ButtonLink href={site.linkedin} icon={<Network size={16} />} eventName="LinkedIn Visit">
              Connect on LinkedIn
            </ButtonLink>
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
