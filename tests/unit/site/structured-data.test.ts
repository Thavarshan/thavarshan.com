import { describe, expect, it } from "vitest";
import { validateStructuredData } from "@/features/seo/structured-data";

const base = "https://thavarshan.com";
const person = { "@type": "Person", "@id": `${base}/#person`, name: "Jerome Thayananthajothy" };
const website = { "@type": "WebSite", "@id": `${base}/#website`, url: base };
const profilePage = { "@type": "ProfilePage", "@id": `${base}/#profile-page`, url: base, mainEntity: { "@id": person["@id"] } };
const breadcrumbs = {
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: base },
    { "@type": "ListItem", position: 2, name: "Insights", item: `${base}/insights` }
  ]
};
const article = {
  "@type": "Article",
  "@id": `${base}/insights/one#article`,
  headline: "A real article",
  url: `${base}/insights/one`,
  mainEntityOfPage: `${base}/insights/one`,
  datePublished: "2026-10-01",
  dateModified: "2026-10-02",
  author: { "@id": person["@id"] },
  publisher: { "@id": website["@id"] }
};
const graph = (...nodes: Record<string, unknown>[]) => ({ "@context": "https://schema.org", "@graph": nodes });

describe("JSON-LD semantic checks", () => {
  it("accepts a linked Person/ProfilePage/WebSite and canonical Article/BreadcrumbList graph", () => {
    expect(() => validateStructuredData(graph(website, profilePage, person))).not.toThrow();
    expect(() => validateStructuredData(graph(article, person, breadcrumbs))).not.toThrow();
  });

  it("rejects duplicate entity IDs and duplicate core entity types", () => {
    expect(() => validateStructuredData(graph(person, { ...person }))).toThrow();
    expect(() => validateStructuredData(graph(person, { ...person, "@id": `${base}/#another-person` }))).toThrow(/Duplicate core/);
  });

  it("rejects unlinked profiles, misleading Article canonicals and broken breadcrumb order", () => {
    expect(() => validateStructuredData(graph(website, profilePage))).toThrow(/reference/);
    expect(() => validateStructuredData(graph({ ...article, mainEntityOfPage: `${base}/wrong` }))).toThrow(/canonical/);
    expect(() => validateStructuredData(graph({ ...breadcrumbs, itemListElement: [{ ...breadcrumbs.itemListElement[0], position: 2 }] }))).toThrow(/ordered/);
  });
});
