import profileData from "@/data/profile.generated.json";
import { parseProfessionalProfile } from "@/lib/profile-schema";

export const profile = parseProfessionalProfile(profileData);

export function getCurrentExperience() {
  return profile.experience.find((item) => item.endDate === null) ?? profile.experience[0];
}

export function formatProfileDate(value?: string | null) {
  if (!value) {
    return "Present";
  }

  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en", { month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1))
  );
}

export function formatProfilePeriod(startDate?: string, endDate?: string | null) {
  if (!startDate && !endDate) {
    return "";
  }

  if (!startDate) {
    return formatProfileDate(endDate);
  }

  return `${formatProfileDate(startDate)} - ${formatProfileDate(endDate)}`;
}
