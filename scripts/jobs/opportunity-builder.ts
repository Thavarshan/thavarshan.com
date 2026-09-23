import { assessOpportunity, canonicalizeJobUrl, computeContentFingerprint, opportunityId, type Opportunity } from "../../lib/job-opportunities";
import { parseSalary } from "../../lib/job-salary";
import { stripHtml } from "./xml";

export function splitTitle(value: string) {
  const separators = [" at ", " – ", " — ", " - "];
  for (const separator of separators) {
    const index = value.lastIndexOf(separator);
    if (index > 0) return { title: value.slice(0, index).trim(), company: value.slice(index + separator.length).trim() || null };
  }
  return { title: value.trim(), company: null };
}

export function normalizeJobType(value: string) {
  if (!value) return null;
  return value
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("-");
}

export function buildSyntheticSummary(input: { company?: string | null; location?: string | null; employmentType?: string | null; salary?: string | null }) {
  return [
    input.company ? `Company: ${input.company}.` : null,
    input.location ? `Location: ${input.location}.` : null,
    input.employmentType ? `Type: ${input.employmentType}.` : null,
    input.salary ? `Salary: ${input.salary}.` : null
  ].filter(Boolean).join(" ");
}

export const knownTagPattern = /\b(?:Laravel|PHP|React|Vue(?:\.js)?|Inertia|Livewire|AWS|MySQL|Postgres|Redis|Docker|Kubernetes|Tailwind|TypeScript|Next\.js|Nuxt(?:\.js)?|GraphQL|Terraform|Stripe|PHPUnit|Pest|Alpine\.js|Filament|Statamic|Nova|Elasticsearch|RabbitMQ|Kafka)\b/gi;

export interface BuildOpportunityInput {
  title: string;
  company?: string | null;
  url: string;
  sourceUrl: string;
  description?: string;
  publishedAt?: string | null;
  source: Opportunity["source"];
  location?: string | null;
  employmentType?: string | null;
  salary?: string | null;
  feedTags?: string[];
}

export function buildOpportunity(input: BuildOpportunityInput, now: string): Opportunity {
  const canonicalUrl = canonicalizeJobUrl(input.url);
  const location = input.location ?? null;
  const employmentType = input.employmentType ?? null;
  const salary = input.salary ?? null;
  const descriptionText = stripHtml(input.description ?? "") || buildSyntheticSummary({ company: input.company, location, employmentType, salary });
  const regexTags = (`${input.title} ${descriptionText}`.match(knownTagPattern) ?? []).map((tag) => tag.toLowerCase());
  const tags = [...new Set([...(input.feedTags ?? []).map((tag) => tag.toLowerCase()), ...regexTags])];
  const assessment = assessOpportunity({ title: input.title, descriptionText, location, tags });
  const { salaryMin, salaryMax, salaryCurrency } = parseSalary(salary);

  return {
    id: opportunityId(canonicalUrl),
    source: input.source,
    sourceUrl: input.sourceUrl,
    canonicalUrl,
    title: input.title,
    company: input.company ?? null,
    location,
    employmentType,
    salary,
    salaryMin,
    salaryMax,
    salaryCurrency,
    descriptionText,
    tags,
    contentFingerprint: computeContentFingerprint(input.company, input.title),
    duplicateOfIds: [],
    publishedAt: input.publishedAt ?? null,
    firstSeenAt: now,
    lastSeenAt: now,
    status: "new",
    closedAt: null,
    ...assessment
  };
}
