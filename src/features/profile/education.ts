import { formatProfilePeriod, profile } from "@/features/profile/profile";

export type EducationItem = {
  qualification: string;
  institution: string;
  period: string;
};

export const education: EducationItem[] = profile.education.map((item) => ({
  qualification: item.qualification,
  institution: item.institution,
  period: formatProfilePeriod(item.startDate, item.endDate)
}));
