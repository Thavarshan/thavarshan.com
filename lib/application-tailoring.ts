import type { ProfessionalProfile, SkillRecord } from "./profile-schema";

const knownSkillCategories: SkillRecord["category"][] = ["leadership", "ai-architecture", "full-stack", "cloud-delivery"];

export interface RawCvTailoringPlan {
  emphasizedSkillCategories?: unknown;
  experienceOrder?: unknown;
  highlightSelections?: unknown;
  reviewFlags?: unknown;
}

export interface SanitizedCvTailoringPlan {
  emphasizedSkillCategories: SkillRecord["category"][];
  experienceOrder: string[];
  highlightSelections: Record<string, string[]>;
  reviewFlags: string[];
  warnings: string[];
}

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function isSkillCategory(value: unknown): value is SkillRecord["category"] {
  return typeof value === "string" && (knownSkillCategories as string[]).includes(value);
}

/**
 * Sanitizes an untrusted model-returned tailoring plan into one that is safe to render onto the
 * CV: every skill-category and experience-id reference is validated against the real profile,
 * and every suggested highlight must exactly match (post-whitespace-normalization) a highlight
 * that already exists in the candidate's verified profile. Nothing here can introduce new claims
 * — only reorder or select among facts that were already present and human-reviewed.
 */
export function validateCvTailoringPlan(
  raw: RawCvTailoringPlan | null | undefined,
  profile: Pick<ProfessionalProfile, "experience">
): SanitizedCvTailoringPlan {
  const warnings: string[] = [];

  const rawCategories = Array.isArray(raw?.emphasizedSkillCategories) ? raw.emphasizedSkillCategories : [];
  const uniqueCategories = [...new Set(rawCategories.filter(isSkillCategory))];
  const emphasizedSkillCategories = uniqueCategories.length === knownSkillCategories.length ? uniqueCategories : knownSkillCategories;
  if (emphasizedSkillCategories !== uniqueCategories) {
    warnings.push("emphasizedSkillCategories was not a valid permutation of the known categories; using the default order");
  }

  const knownExperienceIds = profile.experience.map((role) => role.id);
  const rawOrder = Array.isArray(raw?.experienceOrder) ? raw.experienceOrder.filter((id): id is string => typeof id === "string") : [];
  const filteredOrder = [...new Set(rawOrder.filter((id) => knownExperienceIds.includes(id)))];
  const missingIds = knownExperienceIds.filter((id) => !filteredOrder.includes(id));
  if (missingIds.length > 0 && rawOrder.length > 0) {
    warnings.push(`experienceOrder omitted ${missingIds.length} known entr${missingIds.length === 1 ? "y" : "ies"}; appended in original order`);
  }
  const experienceOrder = [...filteredOrder, ...missingIds];

  const rawSelections =
    raw?.highlightSelections && typeof raw.highlightSelections === "object" && !Array.isArray(raw.highlightSelections)
      ? (raw.highlightSelections as Record<string, unknown>)
      : {};

  const highlightSelections: Record<string, string[]> = {};
  for (const role of profile.experience) {
    const providedRaw = rawSelections[role.id];
    const provided = Array.isArray(providedRaw) ? providedRaw.filter((item): item is string => typeof item === "string") : [];
    if (provided.length === 0) continue;

    const realHighlights = new Set(role.highlights.map(normalizeWhitespace));
    const matched = [...new Set(provided.map(normalizeWhitespace).filter((text) => realHighlights.has(text)))];

    if (matched.length === 0) {
      warnings.push(`All highlights suggested for "${role.role}" were unrecognized; keeping its default highlights`);
      continue;
    }
    if (matched.length < provided.length) {
      warnings.push(`Some highlights suggested for "${role.role}" did not match the profile verbatim and were dropped`);
    }
    highlightSelections[role.id] = matched;
  }

  const reviewFlags = Array.isArray(raw?.reviewFlags) ? raw.reviewFlags.filter((flag): flag is string => typeof flag === "string") : [];

  return { emphasizedSkillCategories, experienceOrder, highlightSelections, reviewFlags, warnings };
}
