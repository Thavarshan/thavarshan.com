import { z } from "zod";

const route = z.string().regex(/^\/(?:[a-z0-9-]+(?:\/[a-z0-9-]+)*)?$/);
export const positioningSchema = z
  .object({
    schemaVersion: z.literal(1),
    reviewedAt: z.iso.date(),
    pages: z
      .array(
        z
          .object({
            path: route,
            primaryIntent: z.string().min(12),
            topic: z.enum(["laravel-php", "api-architecture", "developer-tools", "modernization", "leadership", "ai-cloud", "privacy"]),
            audience: z.string().min(5),
            supportingIntents: z.array(z.string().min(3)).min(1),
            evidence: z
              .array(
                z
                  .string()
                  .regex(/^(?:src|data|content)\/[a-zA-Z0-9/._[\]-]+$/)
                  .refine((path) => !path.split("/").some((part) => part === ".." || part === "."), "Evidence must stay inside public source directories")
              )
              .min(1),
            cta: z.string().min(1)
          })
          .strict()
      )
      .min(1)
      .max(500)
  })
  .strict();
export type Positioning = z.infer<typeof positioningSchema>;

/** One concrete intent per canonical page; a shared topic is not competing intent. */
export function validatePositioning(value: unknown, canonicalPaths: string[]) {
  const map = positioningSchema.parse(value);
  const paths = map.pages.map((page) => page.path);
  const intents = map.pages.map((page) => page.primaryIntent.trim().toLowerCase().replace(/\s+/g, " "));
  if (new Set(paths).size !== paths.length) throw new Error("Duplicate positioning route");
  if (new Set(intents).size !== intents.length) throw new Error("Competing primary intents need editorial review");
  const mapped = new Set(paths);
  const canonical = new Set(canonicalPaths);
  if (canonical.size !== canonicalPaths.length || canonical.size !== mapped.size || [...canonical].some((path) => !mapped.has(path)))
    throw new Error("Positioning must cover exactly the current canonical sitemap pages");
  for (const page of map.pages) {
    const cta = new URL(page.cta, "https://thavarshan.com");
    if (cta.protocol !== "https:" || cta.username || cta.password) throw new Error("Invalid positioning CTA");
    if (cta.origin === "https://thavarshan.com" && !canonical.has(cta.pathname) && cta.pathname !== "/docs/Jerome-Resume.pdf")
      throw new Error("Positioning CTA references an unknown page");
  }
  return map;
}
