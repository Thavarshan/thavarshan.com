export type PlausibleGoal =
  | "Contact"
  | "Resume Download"
  | "LinkedIn Visit"
  | "GitHub Visit"
  | "Repository Visit"
  | "Newsletter Visit"
  | "Insight 75% Read";

export function plausibleEventClass(goal?: PlausibleGoal) {
  return goal ? `plausible-event-name=${goal.replaceAll(" ", "+")}` : "";
}

export function withUtm(url: string, source: "linkedin" | "github" | "devto", medium: "social" | "referral" | "newsletter", campaign: string) {
  const parsed = new URL(url);
  parsed.searchParams.set("utm_source", source);
  parsed.searchParams.set("utm_medium", medium);
  parsed.searchParams.set("utm_campaign", campaign);

  return parsed.toString();
}
