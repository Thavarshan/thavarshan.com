/** Minimal semantic checks shared by all static JSON-LD pages; no rich-result claims. */
export function validateStructuredData(data: Record<string, unknown>): void {
  if (data["@context"] !== "https://schema.org") throw new Error("JSON-LD must use schema.org context");

  const nodes: Record<string, unknown>[] = Array.isArray(data["@graph"]) ? (data["@graph"] as Record<string, unknown>[]) : [data];
  const ids = new Set<string>();
  const coreTypes = new Set<string>();
  for (const node of nodes) {
    if (!node || typeof node !== "object" || typeof node["@type"] !== "string") throw new Error("JSON-LD nodes require a type");
    const type = node["@type"];
    const id = node["@id"];
    if (id !== undefined) {
      if (typeof id !== "string" || !id.startsWith("https://") || ids.has(id)) throw new Error("JSON-LD node IDs must be unique absolute HTTPS URLs");
      ids.add(id);
    }
    if (["WebSite", "ProfilePage", "Person"].includes(type)) {
      if (coreTypes.has(type)) throw new Error(`Duplicate core JSON-LD entity: ${type}`);
      coreTypes.add(type);
    }
    if (type === "Article") {
      if (typeof node.headline !== "string" || typeof node.url !== "string" || node.mainEntityOfPage !== node.url)
        throw new Error("Article JSON-LD must identify its canonical article page");
      if (typeof node.datePublished !== "string" || typeof node.dateModified !== "string") throw new Error("Article JSON-LD requires publication dates");
    }
    if (type === "BreadcrumbList") {
      const items = node.itemListElement;
      if (!Array.isArray(items) || items.length === 0) throw new Error("JSON-LD breadcrumbs require items");
      for (const [index, item] of items.entries()) {
        if (
          !item ||
          item["@type"] !== "ListItem" ||
          item.position !== index + 1 ||
          typeof item.name !== "string" ||
          typeof item.item !== "string" ||
          !item.item.startsWith("https://")
        )
          throw new Error("JSON-LD breadcrumbs must have ordered, canonical items");
      }
    }
  }
  const profilePage = nodes.find((node) => node["@type"] === "ProfilePage");
  if (profilePage) {
    const person = nodes.find((node) => node["@type"] === "Person");
    if (!person || (profilePage.mainEntity as Record<string, unknown> | undefined)?.["@id"] !== person["@id"])
      throw new Error("ProfilePage must reference its Person entity");
  }
}
