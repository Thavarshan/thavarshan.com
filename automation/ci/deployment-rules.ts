export const productionOrigin = "https://thavarshan.com";
export type DeploymentMode = "production" | "preview";
export interface DeploymentFailure {
  url: string;
  rule: string;
  detail: string;
}

export function deploymentOrigin(input: string, mode: DeploymentMode): string {
  const url = new URL(input);
  const validHost =
    mode === "production"
      ? url.hostname === "thavarshan.com"
      : /^(?:deploy-preview-\d+|[a-z0-9]+(?:-[a-z0-9]+)*)--thavarshan\.netlify\.app$/.test(url.hostname);
  if (!validHost || url.protocol !== "https:" || url.username || url.password || url.port || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("Deployment URL must be the production origin or an HTTPS preview origin for this Netlify site");
  }
  return url.origin;
}

export function revisionMatches(value: unknown, expected: string, mode: DeploymentMode): boolean {
  if (!/^[a-f0-9]{40}$/.test(expected) || !value || typeof value !== "object") return false;
  const marker = value as Record<string, unknown>;
  return (
    marker.schemaVersion === 1 &&
    marker.revision === expected &&
    (mode === "production" ? marker.context === "production" : ["deploy-preview", "branch-deploy"].includes(String(marker.context)))
  );
}

export function checkHeaders(
  url: string,
  status: number,
  headers: Headers,
  mode: DeploymentMode,
  kind: "html" | "pdf" | "missing" = "html"
): DeploymentFailure[] {
  const failures: DeploymentFailure[] = [];
  const require = (ok: boolean, rule: string, detail: string) => {
    if (!ok) failures.push({ url, rule, detail });
  };
  require(status === (kind === "missing" ? 404 : 200), "http-status", `Unexpected status ${status}`);
  require(headers.get("x-content-type-options") === "nosniff", "security:nosniff", "Missing nosniff header");
  require(headers.get("x-frame-options") === "DENY", "security:frame", "Missing frame denial");
  require((headers.get("content-security-policy") || "").includes("object-src 'none'"), "security:csp", "Missing expected CSP");
  require(/max-age=31536000/.test(headers.get("strict-transport-security") || ""), "security:hsts", "Missing HSTS");
  require(headers.get("referrer-policy") === "strict-origin-when-cross-origin", "security:referrer", "Unexpected referrer policy");
  require((headers.get("permissions-policy") || "").includes("camera=()"), "security:permissions", "Missing permissions policy");
  const noindex = /\b(noindex|none)\b/i.test(headers.get("x-robots-tag") || "");
  require(mode === "preview" || kind === "pdf" ? noindex : kind === "missing" || !noindex, "indexability", "Unexpected X-Robots-Tag");
  if (kind !== "missing")
    require((headers.get("content-type") || "").includes(kind === "pdf" ? "application/pdf" : "text/html"), "content-type", `Expected ${kind}`);
  return failures;
}

export function checkHtml(url: string, html: string, mode: DeploymentMode): DeploymentFailure[] {
  const failures: DeploymentFailure[] = [];
  const path = new URL(url).pathname;
  const canonical = new RegExp(
    `<link\\b[^>]*rel=["']canonical["'][^>]*href=["']${productionOrigin.replaceAll(".", "\\.")}${path === "/" ? "/?" : path}["']`,
    "i"
  );
  if (!canonical.test(html)) failures.push({ url, rule: "canonical", detail: "Canonical must match the production URL" });
  if (mode === "production" && /<meta\b[^>]*name=["']robots["'][^>]*content=["'][^"']*\bnoindex\b/i.test(html))
    failures.push({ url, rule: "indexability", detail: "Production HTML contains noindex" });
  return failures;
}

export function checkRedirect(url: string, status: number, location: string | null, expected: string): DeploymentFailure[] {
  try {
    if (location && [301, 308].includes(status) && new URL(location, url).href === expected) return [];
  } catch {
    /* Malformed locations must fail too. */
  }
  return [{ url, rule: "redirect", detail: `Expected a permanent redirect to ${expected}` }];
}
