export function withUtm(
  url: string,
  source: "linkedin" | "github" | "devto" | "reddit",
  medium: "social" | "referral" | "newsletter" | "community",
  campaign: string
) {
  const parsed = new URL(url);
  parsed.searchParams.set("utm_source", source);
  parsed.searchParams.set("utm_medium", medium);
  parsed.searchParams.set("utm_campaign", campaign);

  return parsed.toString();
}
