import { site } from "@/data/site";
import { getAllInsights } from "@/lib/insights";

export const dynamic = "force-static";

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function GET() {
  const insights = getAllInsights();
  const latest = insights[0]?.updatedAt ?? insights[0]?.publishedAt ?? new Date().toISOString();
  const items = insights
    .map((insight) => {
      const url = `${site.url}/insights/${insight.slug}`;
      return `
        <item>
          <title>${escapeXml(insight.title)}</title>
          <link>${url}</link>
          <guid>${url}</guid>
          <description>${escapeXml(insight.description)}</description>
          <pubDate>${new Date(insight.publishedAt).toUTCString()}</pubDate>
        </item>`;
    })
    .join("");

  return new Response(
    `<?xml version="1.0" encoding="UTF-8" ?>
      <rss version="2.0">
        <channel>
          <title>${escapeXml(`${site.name} Engineering Insights`)}</title>
          <link>${site.url}/insights</link>
          <description>${escapeXml("First-hand notes on AI systems, platform engineering, architecture modernization, and developer tools.")}</description>
          <language>en</language>
          <lastBuildDate>${new Date(latest).toUTCString()}</lastBuildDate>
          ${items}
        </channel>
      </rss>`,
    {
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8"
      }
    }
  );
}
