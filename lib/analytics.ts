export type PlausibleGoal =
  | "Contact"
  | "Resume Download"
  | "LinkedIn Visit"
  | "GitHub Visit"
  | "Repository Visit"
  | "Newsletter Visit"
  | "Insight 75% Read"
  // Developer tools. Goals are click counts only: no tool input, output or file content is ever an event property.
  | "Tool Example Load"
  | "Tool Copy Output";

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
