import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, GitFork, Star } from "lucide-react";
import githubData from "@/data/github.generated.json";
import { ButtonLink } from "@/components/button-link";
import { JsonLd } from "@/components/json-ld";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { site } from "@/data/site";
import { githubSnapshotSchema } from "@/lib/github-model";
import { getFeaturedGitHubProject } from "@/lib/projects";

type ProjectPageProps = {
  params: Promise<{ repository: string }>;
};

export function generateStaticParams() {
  return githubSnapshotSchema.parse(githubData).projects.map((project) => ({ repository: project.repository }));
}

export async function generateMetadata({ params }: ProjectPageProps): Promise<Metadata> {
  const { repository } = await params;
  const project = await getFeaturedGitHubProject(repository);
  if (!project) {
    return {};
  }

  return {
    title: `${project.name} Open-Source Project`,
    description: project.description,
    alternates: { canonical: `/projects/${project.repository}` },
    openGraph: {
      title: `${project.name} by ${site.name}`,
      description: project.description,
      url: `/projects/${project.repository}`,
      type: "website"
    }
  };
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { repository } = await params;
  const project = await getFeaturedGitHubProject(repository);
  if (!project) {
    notFound();
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareSourceCode",
        name: project.name,
        description: project.description,
        url: `${site.url}/projects/${project.repository}`,
        codeRepository: project.repositoryUrl,
        programmingLanguage: project.primaryLanguage,
        author: { "@id": `${site.url}/#person` },
        dateModified: project.updatedAt,
        keywords: project.topics.join(", ")
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: site.url },
          { "@type": "ListItem", position: 2, name: "Projects", item: `${site.url}/projects` },
          { "@type": "ListItem", position: 3, name: project.name, item: `${site.url}/projects/${project.repository}` }
        ]
      }
    ]
  };

  return (
    <main>
      <JsonLd data={jsonLd} />
      <SiteNav />
      <article>
        <header className="border-b border-[var(--line)] bg-[var(--surface)]">
          <div className="mx-auto w-full max-w-5xl px-5 pb-14 pt-32 lg:px-8">
            <Link href="/projects" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)]">
              <ArrowLeft size={16} /> All projects
            </Link>
            <p className="mt-10 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent-dark)]">
              Open-source project
            </p>
            <h1 className="mt-4 font-display text-5xl leading-tight text-[var(--ink)] md:text-7xl">{project.name}</h1>
            <p className="mt-6 max-w-3xl text-xl leading-9 text-[var(--muted)]">{project.description}</p>
            <div className="mt-7 flex flex-wrap items-center gap-5 text-sm font-semibold text-[var(--muted)]">
              <span className="inline-flex items-center gap-1.5"><Star size={17} />{project.stars.toLocaleString()} stars</span>
              <span className="inline-flex items-center gap-1.5"><GitFork size={17} />{project.forks.toLocaleString()} forks</span>
              {project.primaryLanguage ? <span>{project.primaryLanguage}</span> : null}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href={project.repositoryUrl} variant="primary" icon={<ArrowUpRight size={16} />}>View repository</ButtonLink>
              {project.homepage ? <ButtonLink href={project.homepage} icon={<ArrowUpRight size={16} />}>Documentation</ButtonLink> : null}
            </div>
          </div>
        </header>

        <div className="mx-auto grid w-full max-w-5xl gap-12 px-5 py-16 md:grid-cols-[1fr_15rem] lg:px-8">
          <section aria-labelledby="about-project">
            <h2 id="about-project" className="font-display text-3xl text-[var(--ink)]">About the project</h2>
            <div className="mt-6 space-y-5">
              {(project.readmeExcerpt.length ? project.readmeExcerpt : [project.description]).map((paragraph) => (
                <p key={paragraph} className="text-base leading-8 text-[var(--muted)]">{paragraph}</p>
              ))}
            </div>
          </section>
          <aside aria-label="Repository details">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent-dark)]">Repository details</h2>
            <dl className="mt-5 space-y-5 text-sm">
              <div>
                <dt className="font-semibold text-[var(--ink)]">Maintainer</dt>
                <dd className="mt-1 text-[var(--muted)]">{site.name}</dd>
              </div>
              <div>
                <dt className="font-semibold text-[var(--ink)]">Last updated</dt>
                <dd className="mt-1 text-[var(--muted)]">
                  {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(project.updatedAt))}
                </dd>
              </div>
            </dl>
            <div className="mt-6 flex flex-wrap gap-2">
              {project.topics.map((topic) => (
                <span key={topic} className="rounded-full border border-[var(--line)] bg-white px-3 py-1 text-xs font-medium text-[var(--cool)]">
                  {topic}
                </span>
              ))}
            </div>
          </aside>
        </div>
      </article>
      <SiteFooter />
    </main>
  );
}
