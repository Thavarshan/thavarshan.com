import type { MarkdownBlock } from "@/lib/insight-model";

type MarkdownContentProps = {
  blocks: MarkdownBlock[];
};

export function MarkdownContent({ blocks }: MarkdownContentProps) {
  return (
    <div className="space-y-7">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const Heading = block.depth === 2 ? "h2" : "h3";
          return (
            <Heading
              key={`${block.type}-${index}`}
              className={block.depth === 2 ? "pt-5 font-display text-3xl leading-tight text-[var(--ink)]" : "pt-3 text-xl font-semibold text-[var(--ink)]"}
            >
              {block.text}
            </Heading>
          );
        }

        if (block.type === "list") {
          return (
            <ul key={`${block.type}-${index}`} className="space-y-3 text-base leading-8 text-[var(--ink)]">
              {block.items.map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={`${block.type}-${index}`} className="text-base leading-8 text-[var(--muted)]">
            {block.text}
          </p>
        );
      })}
    </div>
  );
}
