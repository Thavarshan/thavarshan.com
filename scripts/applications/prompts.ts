import type { Opportunity } from "../../lib/job-opportunities";
import type { ProfessionalProfile } from "../../lib/profile-schema";

export function buildSystemPrompt(): string {
  return [
    "You are an assistant that prepares a tailored job application based STRICTLY on facts already present in the candidate profile and target job JSON provided to you. You are not submitting anything — only drafting material for the candidate to review.",
    "Rules you must follow exactly:",
    "- Never invent, exaggerate, or imply experience, employers, skills, metrics, dates, or credentials that are not explicitly present in the candidate profile.",
    "- For `highlightSelections`, select and reorder bullet points copied VERBATIM (character-for-character) from that role's existing `highlights` array. Never paraphrase or write a new bullet. Every `experienceId` you reference must be one of the ids given in the profile.",
    "- For `experienceOrder`, return every experience `id` from the profile exactly once, reordered by relevance to the target job.",
    "- For `emphasizedSkillCategories`, return all four category keys — leadership, ai-architecture, full-stack, cloud-delivery — reordered by relevance to the target job.",
    "- `coverLetterBody` is a concise, professional cover letter (roughly 250-400 words) addressed to the target company's hiring team, in the candidate's voice, using only facts present in the candidate profile and the target job description. Do not fabricate enthusiasm about product details that were not provided to you. Do not include a salutation or signature line — those are added separately.",
    "- `reviewFlags` is a short list (can be empty) of anything a human should double-check before sending — e.g. an ambiguous requirement, a detail the job posting didn't specify."
  ].join("\n");
}

export function buildUserPrompt(params: { profile: ProfessionalProfile; job: Opportunity }): string {
  const { profile, job } = params;

  const payload = {
    candidateProfile: {
      name: profile.identity.name,
      headline: profile.identity.headline,
      location: profile.identity.location,
      summary: profile.summary,
      experience: profile.experience.map((role) => ({
        id: role.id,
        role: role.role,
        company: role.company,
        period: `${role.startDate} to ${role.endDate ?? "present"}`,
        highlights: role.highlights
      })),
      skills: profile.skills.map((skill) => ({ name: skill.name, category: skill.category })),
      education: profile.education.map((entry) => ({ qualification: entry.qualification, institution: entry.institution })),
      certifications: profile.certifications.map((entry) => entry.name)
    },
    targetJob: {
      title: job.title,
      company: job.company,
      location: job.location,
      workArrangement: job.workArrangement,
      employmentType: job.employmentType,
      salary: job.salary,
      tags: job.tags,
      descriptionText: job.descriptionText.slice(0, 6000),
      whyThisIsAGoodMatch: job.reasons
    }
  };

  return [
    "Here is the candidate profile and the target job. Respond only with the JSON object matching the required schema.",
    JSON.stringify(payload, null, 2)
  ].join("\n\n");
}
