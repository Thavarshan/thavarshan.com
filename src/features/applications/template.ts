import type { ProfessionalProfile } from "../profile/profile-schema";
import type { GitHubSnapshot } from "../github/github-model";
import type { Opportunity } from "../jobs/opportunities";

export const TEMPLATE_VERSION = "template-v1";

/** Literal token matching deliberately avoids inferring proficiency, tenure or synonyms. */
function mentions(text: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "iu").test(text);
}

// Keep untrusted posting text inert even when the private Markdown is rendered by GitHub.
export function escapeApplicationMarkdown(value: string): string {
  return value.replace(/[\r\n\t]/g, " ").replace(/[\\`*_{}[\]()<>#!|~]/g, (char) => `\\${char}`);
}

export function prepareApplication(profile: ProfessionalProfile, github: GitHubSnapshot, job: Opportunity) {
  if (job.eligibility !== "eligible" || job.status === "closed") throw new Error("Opportunity is not eligible and open");
  for (const url of [job.canonicalUrl, job.sourceUrl, job.applicationUrl].filter((url): url is string => Boolean(url))) {
    if (!["https:", "http:"].includes(new URL(url).protocol)) throw new Error("Unsupported application URL");
  }
  const posting = `${job.title}\n${job.tags.join("\n")}\n${job.descriptionText}`;
  const matchedSkills = profile.skills.filter((skill) => mentions(posting, skill.name));
  const matches = matchedSkills.map((skill) => ({
    term: skill.name,
    evidence: [`profile.skills: ${skill.name} (${skill.category})`]
  }));
  // Tags are source labels, not an exhaustive or authoritative requirements parser.
  const gaps = job.tags.filter((tag) => !matchedSkills.some((skill) => skill.name.toLowerCase() === tag.toLowerCase()));
  const roleMatches = profile.experience.map((role, index) => ({
    role,
    index,
    highlights: role.highlights.filter((highlight) => matchedSkills.some((skill) => mentions(highlight, skill.name)))
  }));
  roleMatches.sort((a, b) => b.highlights.length - a.highlights.length || a.index - b.index);
  const projects = [
    ...profile.professionalProjects.map((project) => ({ source: `profile.professionalProjects.${project.id}`, text: project.description })),
    ...github.projects.map((project) => ({ source: `github.projects.${project.repository}`, text: project.description }))
  ].filter((project) => matchedSkills.some((skill) => mentions(project.text, skill.name)));
  const caution = [
    "Human review required; keyword overlap does not establish proficiency or satisfy every requirement.",
    "Confirm years of experience, salary expectations, work authorization, location and sponsorship directly; no claims are inferred.",
    ...(job.sponsorship !== "confirmed" ? ["Sponsorship is not confirmed in the snapshot."] : []),
    ...(job.workArrangement === "unknown" ? ["Work arrangement is unknown in the snapshot."] : []),
    ...job.concerns
  ];
  const categories = ["leadership", "ai-architecture", "full-stack", "cloud-delivery"];
  categories.sort((a, b) => matchedSkills.filter((skill) => skill.category === b).length - matchedSkills.filter((skill) => skill.category === a).length);
  const selectedEvidence = roleMatches.flatMap(({ role, highlights }) => highlights.map((text) => ({ source: `profile.experience.${role.id}`, text })));
  const letterEvidence = selectedEvidence.slice(0, 3);
  const coverLetterBody = [
    "I would welcome the opportunity to discuss this role. The following examples are drawn from my professional profile:",
    ...(letterEvidence.length ? letterEvidence.map((item) => item.text) : [profile.summary]),
    "I would be happy to discuss how this experience relates to your requirements. Please review this draft and confirm the role's location and work authorization requirements before sending."
  ].join("\n\n");
  const markdown = [
    "# Application preparation",
    "",
    "**Template draft — human review required. Never submitted automatically.**",
    `- Role: ${escapeApplicationMarkdown(job.title)} / ${escapeApplicationMarkdown(job.company ?? "Unknown company")}`,
    `- Apply: ${escapeApplicationMarkdown(job.applicationUrl ?? job.canonicalUrl)}`,
    `- Canonical listing: ${escapeApplicationMarkdown(job.canonicalUrl)}`,
    `- Source: ${escapeApplicationMarkdown(job.sourceUrl)}`,
    `- Eligibility: ${job.eligibility}; fit score: ${job.score}; arrangement: ${job.workArrangement}; sponsorship: ${job.sponsorship}`,
    `- Location (listing): ${escapeApplicationMarkdown(job.location ?? "Unknown")}; salary (listing): ${escapeApplicationMarkdown(job.salary ?? "Unknown")}`,
    "",
    "## Evidence-backed match matrix",
    ...matches.map((match) => `- ${escapeApplicationMarkdown(match.term)} — ${escapeApplicationMarkdown(match.evidence.join("; "))}`),
    ...(matches.length ? [] : ["- No exact skill-name overlap was found; this is not a suitability assessment."]),
    ...selectedEvidence.map((item) => `- ${escapeApplicationMarkdown(item.source)} — ${escapeApplicationMarkdown(item.text)}`),
    ...projects.map((item) => `- ${escapeApplicationMarkdown(item.source)} — ${escapeApplicationMarkdown(item.text)}`),
    "",
    "## Gaps and unknowns",
    ...gaps.map((tag) => `- Source tag without exact profile-skill evidence: ${escapeApplicationMarkdown(tag)}. Verify manually; do not claim it.`),
    ...caution.map((text) => `- ${escapeApplicationMarkdown(text)}`),
    "- Descriptions are not exhaustively parsed. Review the original posting for all mandatory requirements, including years, credentials and languages.",
    "",
    "## CV tailoring suggestions",
    "- Prioritize roles and verbatim highlights with exact skill overlap. Retain all roles and original dates; do not rewrite achievements.",
    `- Skill category order: ${categories.join(", ")}`,
    ...roleMatches.map(
      ({ role, highlights }) =>
        `- ${escapeApplicationMarkdown(role.id)}: ${highlights.length} matching highlights; ${highlights.length ? "selected verbatim" : "retain original highlights"}.`
    ),
    "",
    "## Interview preparation",
    ...matches.map(
      (match) =>
        `- Prepare a concrete example involving ${escapeApplicationMarkdown(match.term)}; explain your contribution and limitations without inventing metrics.`
    ),
    "- Revisit the cited roles and projects: context, decisions, tradeoffs, outcomes and what you would change.",
    "- Ask the employer about location, sponsorship, responsibilities and any evidence gaps before proceeding.",
    "",
    "## Cover-letter draft",
    ...coverLetterBody.split("\n\n").flatMap((paragraph) => [escapeApplicationMarkdown(paragraph), ""])
  ].join("\n");
  return {
    emphasizedSkillCategories: categories,
    experienceOrder: roleMatches.map(({ role }) => role.id),
    highlightSelections: roleMatches.map(({ role, highlights }) => ({ experienceId: role.id, highlights })),
    reviewFlags: caution,
    coverLetterBody,
    markdown: `${markdown}\n`,
    matches,
    gaps
  };
}
