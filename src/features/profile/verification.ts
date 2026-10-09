/** Ownership values become public meta tags, but must never appear in diagnostics. */
export function verificationMetadata(env: Record<string, string | undefined>) {
  const read = (name: string) => {
    const value = env[name]?.trim();
    if (!value) return undefined;
    if (!/^[A-Za-z0-9_-]{1,512}$/.test(value)) throw new Error(`${name} must contain only the meta tag's ownership value`);
    return value;
  };
  const google = read("GOOGLE_SITE_VERIFICATION");
  const bing = read("BING_SITE_VERIFICATION");
  return {
    ...(google ? { google } : {}),
    ...(bing ? { other: { "msvalidate.01": [bing] } } : {})
  };
}
