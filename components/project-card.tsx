import { ArrowUpRight, GitFork, Star } from "lucide-react";
import { ButtonLink } from "@/components/button-link";
import type { FeaturedProject, ProductProject } from "@/data/projects";

type ProjectCardProps = {
  project: FeaturedProject | ProductProject;
  variant?: "repository" | "product";
  detailsHref?: string;
};

export function ProjectCard({ project, variant = "repository", detailsHref }: ProjectCardProps) {
  const isRepository = variant === "repository" && "repository" in project;
  const actionUrl = "repository" in project ? project.stats?.url ?? `https://github.com/Thavarshan/${project.repository}` : project.url;

  return (
    <article className="group h-full rounded-lg border border-[var(--line)] bg-[var(--surface)] p-6 transition hover:-translate-y-0.5 hover:border-[var(--accent)]">
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent-dark)]">
            {variant === "product" ? "Product" : project.role}
          </p>
          <h3 className="mt-3 text-2xl font-semibold text-[var(--ink)]">{project.name}</h3>
        </div>
        {isRepository && project.stats ? (
          <div className="flex gap-3 text-sm font-semibold text-[var(--muted)]" aria-label={`${project.stats.stars} stars and ${project.stats.forks} forks`}>
            <span className="inline-flex items-center gap-1"><Star size={15} aria-hidden />{project.stats.stars.toLocaleString()}</span>
            <span className="inline-flex items-center gap-1"><GitFork size={15} aria-hidden />{project.stats.forks.toLocaleString()}</span>
          </div>
        ) : null}
      </div>

      <p className="mt-5 text-base leading-7 text-[var(--muted)]">{project.summary}</p>

      <ul className="mt-5 space-y-2 text-sm leading-6 text-[var(--ink)]">
        {project.highlights.map((highlight) => (
          <li key={highlight} className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" aria-hidden />
            <span>{highlight}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex flex-wrap gap-2">
        {project.tags.map((tag) => (
          <span key={tag} className="rounded-full border border-[var(--line)] bg-white px-3 py-1 text-xs font-medium text-[var(--cool)]">
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-7 flex flex-wrap gap-3">
        {detailsHref ? (
          <ButtonLink href={detailsHref} variant="primary" icon={<ArrowUpRight size={16} />}>
            Project details
          </ButtonLink>
        ) : null}
        <ButtonLink href={actionUrl} variant="secondary" icon={<ArrowUpRight size={16} className="transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />} eventName={variant === "product" ? undefined : "Repository Visit"}>
          {variant === "product" ? "Visit Product" : "Repository"}
        </ButtonLink>
        {project.homepage ? (
          <ButtonLink href={project.homepage} variant="ghost" icon={<ArrowUpRight size={16} />} eventName={variant === "product" ? undefined : "Repository Visit"}>
            Docs
          </ButtonLink>
        ) : null}
      </div>
    </article>
  );
}
