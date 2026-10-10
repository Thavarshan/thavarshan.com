import Link from "next/link";
import { tools } from "./registry";

export function RelatedTools({ path }: { path: string }) {
  const related = tools.filter((tool) => tool.related.some((link) => link.href === path));
  if (!related.length) return null;
  return (
    <section aria-labelledby="related-tools" className="mx-auto w-full max-w-5xl px-5 pb-16 lg:px-8">
      <h2 id="related-tools" className="font-display text-3xl text-[var(--ink)]">
        Related developer tools
      </h2>
      <ul className="mt-7 grid gap-4 md:grid-cols-2">
        {related.map((tool) => (
          <li key={tool.slug} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5">
            <Link href={`/tools/${tool.slug}`} className="text-lg font-semibold text-[var(--accent-dark)] underline underline-offset-4">
              {tool.name}
            </Link>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{tool.description}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
