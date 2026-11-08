/**
 * A browser POST must originate from this Worker's own host. Also compare with Host for
 * development proxies that rewrite Request.url; never accept a missing or null Origin.
 */
export function isSameOrigin(request: Request, url: URL): boolean {
  const origin = request.headers.get("Origin");
  if (!origin || origin === "null") return false;
  if (origin === url.origin) return true;
  try {
    const host = request.headers.get("Host");
    return host !== null && new URL(origin).host === host;
  } catch {
    return false;
  }
}
