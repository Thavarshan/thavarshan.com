import { describe, expect, it } from "vitest";
import { parseWeWorkRemotelyFeed, splitWwrTitle } from "@/scripts/jobs/sources/weworkremotely";

const now = "2026-09-23T00:00:00.000Z";

const feed = (items: string) => `<?xml version="1.0"?><rss><channel>${items}</channel></rss>`;

const laravelItem = `
  <item>
    <title>Acme Co: Senior Laravel Developer</title>
    <link>https://weworkremotely.com/remote-jobs/acme-co-senior-laravel-developer</link>
    <pubDate>Tue, 08 Sep 2026 13:49:13 +0000</pubDate>
    <region>Anywhere in the World</region>
    <description>&lt;p&gt;We need a Laravel developer.&lt;/p&gt;</description>
  </item>
`;

const irrelevantItem = `
  <item>
    <title>Beta Inc: Senior Product Designer</title>
    <link>https://weworkremotely.com/remote-jobs/beta-inc-senior-product-designer</link>
    <pubDate>Tue, 08 Sep 2026 13:49:13 +0000</pubDate>
    <region>Anywhere in the World</region>
    <description>&lt;p&gt;Figma and design systems.&lt;/p&gt;</description>
  </item>
`;

describe("splitWwrTitle", () => {
  it("splits the 'Company: Title' convention", () => {
    expect(splitWwrTitle("Lemon.io: Senior .NET Full-stack Developer")).toEqual({
      title: "Senior .NET Full-stack Developer",
      company: "Lemon.io"
    });
  });

  it("falls back to the whole string as title when there is no colon", () => {
    expect(splitWwrTitle("Senior Laravel Developer")).toEqual({ title: "Senior Laravel Developer", company: null });
  });
});

describe("parseWeWorkRemotelyFeed", () => {
  it("keeps a relevant listing, maps region to location, and filters an irrelevant one", () => {
    const { opportunities, skipped } = parseWeWorkRemotelyFeed(feed(laravelItem + irrelevantItem), now);
    expect(opportunities).toHaveLength(1);
    expect(opportunities[0].title).toBe("Senior Laravel Developer");
    expect(opportunities[0].company).toBe("Acme Co");
    expect(opportunities[0].location).toBe("Anywhere in the World");
    expect(opportunities[0].source).toBe("weworkremotely");
    expect(skipped).toBe(1);
  });

  it("throws when the feed has zero raw items", () => {
    expect(() => parseWeWorkRemotelyFeed(feed(""), now)).toThrow();
  });

  it("does not throw when every raw item is legitimately filtered out by relevance", () => {
    const { opportunities, skipped } = parseWeWorkRemotelyFeed(feed(irrelevantItem), now);
    expect(opportunities).toHaveLength(0);
    expect(skipped).toBe(1);
  });
});
