import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { site } from "../../data/site";
import { getAllInsights, getAbsoluteInsightUrl } from "../../lib/insights";
import { withUtm } from "../../lib/analytics";

function createLinkedInPost(insight: ReturnType<typeof getAllInsights>[number]) {
  const url = withUtm(getAbsoluteInsightUrl(insight.slug, site.url), "linkedin", "social", insight.slug);
  return `${insight.title}

${insight.description}

The full version is on my site:
${url}

Topics: ${insight.topics.join(", ")}`;
}

function createNewsletterSummary(insight: ReturnType<typeof getAllInsights>[number]) {
  const url = withUtm(getAbsoluteInsightUrl(insight.slug, site.url), "linkedin", "newsletter", insight.slug);
  return `Newsletter summary: ${insight.title}

${insight.description}

In the full article I cover the practical decisions, trade-offs, and lessons behind this topic.

Read the canonical version:
${url}`;
}

function createDevDraft(insight: ReturnType<typeof getAllInsights>[number]) {
  const url = withUtm(getAbsoluteInsightUrl(insight.slug, site.url), "devto", "referral", insight.slug);
  return `---
title: ${insight.title}
published: false
canonical_url: ${getAbsoluteInsightUrl(insight.slug, site.url)}
tags: ${insight.topics.slice(0, 4).map((topic) => topic.toLowerCase().replace(/[^a-z0-9]+/g, "")).filter(Boolean).join(", ")}
---

${insight.description}

Read the canonical version on my site: ${url}`;
}

function createFollowUps(insight: ReturnType<typeof getAllInsights>[number]) {
  const url = withUtm(getAbsoluteInsightUrl(insight.slug, site.url), "linkedin", "social", insight.slug);
  return [
    `One idea from "${insight.title}": the useful architecture discussion is usually not "what can we build?" but "what can the team operate, debug, and improve every week?"\n\n${url}`,
    `The longer I work on platforms and developer tools, the more I value APIs that another engineer can use correctly when I am not in the room.\n\nRelated note: ${url}`
  ];
}

async function main() {
  const insights = getAllInsights();
  const outputRoot = resolve("marketing/generated");

  await mkdir(outputRoot, { recursive: true });

  for (const insight of insights) {
    const outputDirectory = resolve(outputRoot, insight.slug);
    const followUps = createFollowUps(insight);
    await mkdir(outputDirectory, { recursive: true });
    await writeFile(resolve(outputDirectory, "linkedin-post.md"), `${createLinkedInPost(insight)}\n`);
    await writeFile(resolve(outputDirectory, "linkedin-newsletter-summary.md"), `${createNewsletterSummary(insight)}\n`);
    await writeFile(resolve(outputDirectory, "devto-draft.md"), `${createDevDraft(insight)}\n`);
    await writeFile(resolve(outputDirectory, "follow-up-1.md"), `${followUps[0]}\n`);
    await writeFile(resolve(outputDirectory, "follow-up-2.md"), `${followUps[1]}\n`);
    await writeFile(
      resolve(outputDirectory, "metadata.json"),
      `${JSON.stringify(
        {
          slug: insight.slug,
          canonicalUrl: getAbsoluteInsightUrl(insight.slug, site.url),
          trackedUrls: {
            linkedin: withUtm(getAbsoluteInsightUrl(insight.slug, site.url), "linkedin", "social", insight.slug),
            newsletter: withUtm(getAbsoluteInsightUrl(insight.slug, site.url), "linkedin", "newsletter", insight.slug),
            devto: withUtm(getAbsoluteInsightUrl(insight.slug, site.url), "devto", "referral", insight.slug)
          },
          socialImage: `${site.url}/insights/${insight.slug}/opengraph-image`,
          topics: insight.topics,
          relatedProjects: insight.relatedProjects,
          readingTimeMinutes: insight.readingTimeMinutes,
          wordCount: insight.wordCount
        },
        null,
        2
      )}\n`
    );
  }

  console.log(`Generated distribution bundles for ${insights.length} insights in ${outputRoot}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
