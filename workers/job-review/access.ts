/**
 * Verifies the Cloudflare Access JWT (RS256) so the Worker fails closed even if the Access
 * application in front of it is removed or misconfigured.
 */
export interface AccessConfig {
  teamDomain: string;
  audience: string;
  allowedEmail: string;
}

interface Jwk extends JsonWebKey {
  kid?: string;
}

const certCache = new Map<string, { keys: Jwk[]; fetchedAt: number }>();
const CERT_TTL_MS = 10 * 60_000;

function decodeBase64Url(value: string) {
  const padded = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

function decodeJson<T>(segment: string): T {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(segment))) as T;
}

async function loadKeys(teamDomain: string, fetcher: typeof fetch, now: number): Promise<Jwk[]> {
  const cached = certCache.get(teamDomain);
  if (cached && now - cached.fetchedAt < CERT_TTL_MS) return cached.keys;
  const response = await fetcher(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!response.ok) throw new Error(`Access certs request failed (${response.status})`);
  const body = (await response.json()) as { keys?: Jwk[] };
  const keys = body.keys ?? [];
  certCache.set(teamDomain, { keys, fetchedAt: now });
  return keys;
}

export function clearAccessCertCache() {
  certCache.clear();
}

/** Returns the authenticated email, or null when the token is missing, invalid, expired or not for this app/user. */
export async function verifyAccessJwt(
  token: string | null,
  config: AccessConfig,
  options: { fetcher?: typeof fetch; now?: number } = {}
): Promise<string | null> {
  if (!token) return null;
  const fetcher = options.fetcher ?? fetch;
  const nowMs = options.now ?? Date.now();

  try {
    const [headerSegment, payloadSegment, signatureSegment, ...rest] = token.split(".");
    if (!headerSegment || !payloadSegment || !signatureSegment || rest.length > 0) return null;

    const header = decodeJson<{ alg?: string; kid?: string }>(headerSegment);
    if (header.alg !== "RS256" || !header.kid) return null;

    const jwk = (await loadKeys(config.teamDomain, fetcher, nowMs)).find((key) => key.kid === header.kid);
    if (!jwk) return null;

    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      decodeBase64Url(signatureSegment),
      new TextEncoder().encode(`${headerSegment}.${payloadSegment}`)
    );
    if (!valid) return null;

    const payload = decodeJson<{ aud?: string | string[]; iss?: string; exp?: number; nbf?: number; email?: string }>(payloadSegment);
    const nowSeconds = nowMs / 1000;
    if (typeof payload.exp !== "number" || payload.exp <= nowSeconds) return null;
    if (typeof payload.nbf === "number" && payload.nbf > nowSeconds + 60) return null;
    if (payload.iss !== `https://${config.teamDomain}`) return null;
    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!audiences.includes(config.audience)) return null;
    if (!payload.email || payload.email.toLowerCase() !== config.allowedEmail.toLowerCase()) return null;
    return payload.email;
  } catch {
    return null;
  }
}
