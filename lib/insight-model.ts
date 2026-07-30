import { z } from "zod";

function isCalendarDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
  .refine(isCalendarDate, "Expected a valid calendar date");

export const insightDefinitionSchema = z
  .object({
    slug: z.string().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    title: z.string().min(1),
    description: z.string().min(1),
    publishedAt: dateSchema,
    updatedAt: dateSchema.optional(),
    topics: z.array(z.string().min(1)).default([]),
    relatedProjects: z.array(z.string().min(1)).default([]),
    featured: z.boolean(),
    draft: z.boolean(),
    linkedinUrl: z.string().url().optional(),
    devToUrl: z.string().url().optional()
  })
  .superRefine((definition, context) => {
    if (definition.updatedAt && definition.updatedAt < definition.publishedAt) {
      context.addIssue({
        code: "custom",
        path: ["updatedAt"],
        message: "updatedAt must be on or after publishedAt"
      });
    }
  });

export type InsightDefinition = z.infer<typeof insightDefinitionSchema>;

export type MarkdownBlock =
  | { type: "heading"; depth: 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] };

export type Insight = InsightDefinition & {
  content: string;
  blocks: MarkdownBlock[];
  readingTimeMinutes: number;
  wordCount: number;
};

function parseScalar(value: string): string | boolean {
  const trimmed = value.trim();

  if (trimmed === "true") {
    return true;
  }

  if (trimmed === "false") {
    return false;
  }

  return trimmed.replace(/^["']|["']$/g, "");
}

function parseFrontmatter(source: string): { frontmatter: Record<string, unknown>; content: string } {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/u.exec(source);
  if (!match) {
    throw new Error("Insight is missing frontmatter");
  }

  const frontmatter: Record<string, unknown> = {};
  const lines = match[1].split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) {
      continue;
    }

    const arrayMatch = /^([A-Za-z][A-Za-z0-9]*):\s*$/u.exec(line);
    if (arrayMatch) {
      const values: string[] = [];
      while (lines[index + 1]?.startsWith("  - ")) {
        index += 1;
        values.push(lines[index].slice(4).trim());
      }
      frontmatter[arrayMatch[1]] = values;
      continue;
    }

    const scalarMatch = /^([A-Za-z][A-Za-z0-9]*):\s*(.*)$/u.exec(line);
    if (!scalarMatch) {
      throw new Error(`Unsupported frontmatter line: ${line}`);
    }

    frontmatter[scalarMatch[1]] = parseScalar(scalarMatch[2]);
  }

  return { frontmatter, content: match[2].trim() };
}

export function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const lines = markdown.split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();

    if (!line) {
      continue;
    }

    if (line.startsWith("## ")) {
      blocks.push({ type: "heading", depth: 2, text: line.slice(3).trim() });
      continue;
    }

    if (line.startsWith("### ")) {
      blocks.push({ type: "heading", depth: 3, text: line.slice(4).trim() });
      continue;
    }

    if (line.startsWith("- ")) {
      const items = [line.slice(2).trim()];
      while (lines[index + 1]?.trim().startsWith("- ")) {
        index += 1;
        items.push(lines[index].trim().slice(2).trim());
      }
      blocks.push({ type: "list", items });
      continue;
    }

    const paragraph = [line];
    while (
      lines[index + 1] &&
      lines[index + 1].trim() &&
      !lines[index + 1].trim().startsWith("## ") &&
      !lines[index + 1].trim().startsWith("### ") &&
      !lines[index + 1].trim().startsWith("- ")
    ) {
      index += 1;
      paragraph.push(lines[index].trim());
    }

    blocks.push({ type: "paragraph", text: paragraph.join(" ") });
  }

  return blocks;
}

export function calculateReadingTime(content: string) {
  const words = content.trim().split(/\s+/u).filter(Boolean).length;
  return {
    wordCount: words,
    readingTimeMinutes: Math.max(1, Math.ceil(words / 220))
  };
}

export function parseInsightSource(source: string): Insight {
  const { frontmatter, content } = parseFrontmatter(source);
  const definition = insightDefinitionSchema.parse(frontmatter);
  const readingTime = calculateReadingTime(content);

  return {
    ...definition,
    content,
    blocks: parseMarkdownBlocks(content),
    ...readingTime
  };
}
