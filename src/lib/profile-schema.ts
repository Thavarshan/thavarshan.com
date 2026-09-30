import { z } from "zod";

const yearMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Expected a YYYY-MM date");
const optionalUrlSchema = z.string().url().optional();

export const profileIdentitySchema = z.object({
  name: z.string().min(1),
  givenName: z.string().min(1),
  familyName: z.string().min(1),
  headline: z.string().min(1),
  location: z.string().min(1),
  email: z.string().email(),
  website: z.string().url(),
  linkedin: z.string().url(),
  github: z.string().url(),
  avatar: z.string().min(1)
});

export const experienceRecordSchema = z.object({
  id: z.string().min(1),
  role: z.string().min(1),
  company: z.string().min(1),
  location: z.string().optional(),
  startDate: yearMonthSchema,
  endDate: yearMonthSchema.nullable(),
  summary: z.string().default(""),
  highlights: z.array(z.string().min(1)).default([])
});

export const educationRecordSchema = z.object({
  id: z.string().min(1),
  qualification: z.string().min(1),
  institution: z.string().min(1),
  fieldOfStudy: z.string().optional(),
  startDate: yearMonthSchema.optional(),
  endDate: yearMonthSchema.optional(),
  summary: z.string().optional()
});

export const certificationRecordSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  authority: z.string().optional(),
  issuedDate: yearMonthSchema.optional(),
  expiresDate: yearMonthSchema.optional(),
  credentialUrl: optionalUrlSchema
});

export const skillRecordSchema = z.object({
  name: z.string().min(1),
  category: z.enum(["leadership", "ai-architecture", "full-stack", "cloud-delivery"])
});

export const languageRecordSchema = z.object({
  name: z.string().min(1),
  proficiency: z.string().optional()
});

export const professionalProjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: z.string().default("Creator"),
  description: z.string().min(1),
  highlights: z.array(z.string().min(1)).default([]),
  tags: z.array(z.string().min(1)).default([]),
  url: optionalUrlSchema,
  startDate: yearMonthSchema.optional(),
  endDate: yearMonthSchema.nullable().optional()
});

export const professionalProfileSchema = z.object({
  schemaVersion: z.literal(1),
  identity: profileIdentitySchema,
  summary: z.string().min(1),
  experience: z.array(experienceRecordSchema).min(1),
  education: z.array(educationRecordSchema),
  certifications: z.array(certificationRecordSchema),
  skills: z.array(skillRecordSchema),
  languages: z.array(languageRecordSchema),
  professionalProjects: z.array(professionalProjectSchema),
  sources: z.object({
    linkedin: z.object({
      kind: z.literal("linkedin-archive"),
      importedAt: z.string().datetime(),
      fingerprint: z.string().min(1)
    }),
    github: z.object({
      kind: z.literal("github-api"),
      username: z.string().min(1),
      syncedAt: z.string().datetime()
    })
  }),
  modifiedAt: z.string().datetime()
});

export type ProfessionalProfile = z.infer<typeof professionalProfileSchema>;
export type ProfileIdentity = z.infer<typeof profileIdentitySchema>;
export type ExperienceRecord = z.infer<typeof experienceRecordSchema>;
export type EducationRecord = z.infer<typeof educationRecordSchema>;
export type CertificationRecord = z.infer<typeof certificationRecordSchema>;
export type SkillRecord = z.infer<typeof skillRecordSchema>;
export type LanguageRecord = z.infer<typeof languageRecordSchema>;
export type ProfessionalProject = z.infer<typeof professionalProjectSchema>;

export function parseProfessionalProfile(input: unknown): ProfessionalProfile {
  return professionalProfileSchema.parse(input);
}
