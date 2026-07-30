import { formatProfilePeriod, profile } from "@/data/profile";

export type ExperienceItem = {
  role: string;
  company: string;
  period: string;
  summary: string;
  highlights: string[];
};

export const experience: ExperienceItem[] = profile.experience.map((item) => ({
  role: item.role,
  company: [item.company, item.location].filter(Boolean).join(", "),
  period: formatProfilePeriod(item.startDate, item.endDate),
  summary: item.summary,
  highlights: item.highlights
}));
