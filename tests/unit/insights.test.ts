import { describe, expect, it } from "vitest";
import githubData from "@/data/github.generated.json";
import { parseInsightSource } from "@/lib/insight-model";
import { assertUniqueInsightSlugs, getAllInsights, validateInsightProjectReferences } from "@/lib/insights";
import { githubSnapshotSchema } from "@/lib/github-model";

describe("insights", () => {
  it("parses frontmatter, content blocks, and reading time", () => {
    const insight = parseInsightSource(`---
slug: example-insight
title: Example Insight
description: A useful example.
publishedAt: 2026-07-30
topics:
  - AI workflows
relatedProjects:
  - comet
featured: true
draft: false
---
## First heading

This is a paragraph with enough words to be counted.

- one
- two`);

    expect(insight.slug).toBe("example-insight");
    expect(insight.blocks).toEqual([
      { type: "heading", depth: 2, text: "First heading" },
      { type: "paragraph", text: "This is a paragraph with enough words to be counted." },
      { type: "list", items: ["one", "two"] }
    ]);
    expect(insight.readingTimeMinutes).toBe(1);
  });

  it("rejects malformed dates", () => {
    expect(() =>
      parseInsightSource(`---
slug: bad-date
title: Bad Date
description: Invalid date.
publishedAt: July 30
topics:
  - SEO
relatedProjects:
  - fetch-php
featured: true
draft: false
---
Body.`)
    ).toThrow();
  });

  it("rejects impossible calendar dates and stale updated dates", () => {
    expect(() =>
      parseInsightSource(`---
slug: impossible-date
title: Impossible Date
description: Invalid date.
publishedAt: 2026-99-99
topics:
  - SEO
relatedProjects:
  - fetch-php
featured: true
draft: false
---
Body.`)
    ).toThrow("Expected a valid calendar date");

    expect(() =>
      parseInsightSource(`---
slug: stale-update
title: Stale Update
description: Invalid update order.
publishedAt: 2026-07-30
updatedAt: 2026-07-29
topics:
  - SEO
relatedProjects:
  - fetch-php
featured: true
draft: false
---
Body.`)
    ).toThrow("updatedAt must be on or after publishedAt");
  });

  it("accepts valid leap-day dates", () => {
    const insight = parseInsightSource(`---
slug: leap-day
title: Leap Day
description: Valid leap day.
publishedAt: 2024-02-29
updatedAt: 2024-02-29
topics:
  - SEO
relatedProjects:
  - fetch-php
featured: true
draft: false
---
Body.`);

    expect(insight.publishedAt).toBe("2024-02-29");
  });

  it("excludes drafts by default and validates related project references", () => {
    const insights = getAllInsights();
    const repositories = githubSnapshotSchema.parse(githubData).projects.map((project) => project.repository);

    expect(insights.every((insight) => !insight.draft)).toBe(true);
    expect(insights).toHaveLength(4);
    expect(() => validateInsightProjectReferences(insights, repositories)).not.toThrow();
  });

  it("detects duplicate slugs", () => {
    expect(() => assertUniqueInsightSlugs([{ slug: "same" }, { slug: "same" }])).toThrow("Duplicate insight slug: same");
  });
});
