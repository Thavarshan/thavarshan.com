/**
 * The Growth Engine event taxonomy (issue #47). One definition shared by the browser, the collector
 * Worker and the snapshot job, so what is sent, accepted and reported can never drift apart.
 *
 * Model: acquisition -> engagement -> intent.
 *  - acquisition is NOT an event: it is the attribution (UTM or referrer class) attached to every event;
 *  - engagement: the visitor did something that shows interest (read, used a tool, visited a profile);
 *  - intent: the visitor took a step toward hiring, collaborating or adopting (repo/demo click, CV
 *    download, contact/hire/consulting CTA, completed a tool).
 *
 * Privacy rules enforced here by construction: every property is an enum or a short lowercase slug,
 * so there is nowhere to put free text, form content, secrets or an identifier.
 */

export type Stage = "engagement" | "intent";

/** Content slugs (articles, projects, tools) can be long; locations are short page names. */
const slug = /^[a-z0-9][a-z0-9-]{0,79}$/;
const location = /^[a-z0-9][a-z0-9-]{0,39}$/;

interface EventDefinition {
  stage: Stage;
  description: string;
  /** Allowed property names and their validators; an unknown property rejects the event. */
  props: Record<string, { required: boolean; valid: (value: string) => boolean }>;
}

const enumOf =
  (...values: string[]) =>
  (value: string) =>
    values.includes(value);
const isSlug = (value: string) => slug.test(value);

export const EVENTS = {
  repo_click: { stage: "intent", description: "Clicked through to a project's repository or package", props: { project: { required: true, valid: isSlug } } },
  demo_click: { stage: "intent", description: "Clicked a project's live demo or documentation site", props: { project: { required: true, valid: isSlug } } },
  cv_download: { stage: "intent", description: "Opened or downloaded the CV", props: { location: { required: false, valid: location.test.bind(location) } } },
  contact_cta: {
    stage: "intent",
    description: "Clicked an email/contact call to action",
    props: { location: { required: false, valid: location.test.bind(location) } }
  },
  hire_cta: { stage: "intent", description: "Clicked a hiring call to action", props: { location: { required: false, valid: location.test.bind(location) } } },
  consulting_cta: {
    stage: "intent",
    description: "Clicked a consulting call to action",
    props: { location: { required: false, valid: location.test.bind(location) } }
  },
  tool_completed: {
    stage: "intent",
    description: "Got a result from a developer tool (once per page view)",
    props: { tool: { required: true, valid: isSlug } }
  },
  tool_output_copied: { stage: "intent", description: "Copied a developer tool's output", props: { tool: { required: true, valid: isSlug } } },
  profile_click: {
    stage: "engagement",
    description: "Visited an external profile",
    props: { network: { required: true, valid: enumOf("linkedin", "github") } }
  },
  insight_read: { stage: "engagement", description: "Scrolled through 75% of an Insight article", props: { slug: { required: true, valid: isSlug } } },
  newsletter_click: { stage: "engagement", description: "Clicked a newsletter link", props: {} }
} as const satisfies Record<string, EventDefinition>;

export type EventName = keyof typeof EVENTS;
export const eventNames = Object.keys(EVENTS) as EventName[];

/** How a visitor reached the site. "unknown" is a real, reported category: it is never guessed. */
export const referrerClasses = ["direct", "search", "social", "code", "community", "internal", "other"] as const;
export type ReferrerClass = (typeof referrerClasses)[number];

const hostClasses: Array<[ReferrerClass, RegExp]> = [
  ["search", /(^|\.)(google|bing|duckduckgo|yahoo|ecosia|brave|kagi|startpage)\.[a-z.]+$/],
  ["social", /(^|\.)(linkedin\.com|lnkd\.in|x\.com|twitter\.com|t\.co|facebook\.com|bsky\.app|mastodon\.[a-z]+)$/],
  ["code", /(^|\.)(github\.com|gitlab\.com|packagist\.org|npmjs\.com|stackoverflow\.com)$/],
  ["community", /(^|\.)(reddit\.com|news\.ycombinator\.com|dev\.to|hashnode\.com|laravel-news\.com|larajobs\.com|medium\.com)$/]
];

/** Classifies a referrer hostname without ever keeping the URL, path or query. */
export function classifyReferrer(referrer: string, ownHost: string): ReferrerClass {
  if (!referrer) return "direct";
  let host: string;
  try {
    host = new URL(referrer).hostname.toLowerCase();
  } catch {
    return "other";
  }
  if (host === ownHost || host.endsWith(`.${ownHost}`)) return "internal";
  return hostClasses.find(([, pattern]) => pattern.test(host))?.[0] ?? "other";
}

export interface Attribution {
  source: string | null;
  medium: string | null;
  campaign: string | null;
}

const utmValue = /^[a-z0-9][a-z0-9_.-]{0,59}$/;

/** UTM values are attacker-controlled (anyone can craft a link), so they are lowercased and allowlisted. */
export function sanitizeUtm(value: string | null | undefined): string | null {
  const candidate = (value ?? "").trim().toLowerCase();
  return utmValue.test(candidate) ? candidate : null;
}

export function attributionFromSearch(search: string): Attribution {
  const params = new URLSearchParams(search);
  return { source: sanitizeUtm(params.get("utm_source")), medium: sanitizeUtm(params.get("utm_medium")), campaign: sanitizeUtm(params.get("utm_campaign")) };
}

/** The wire format. Short, flat, and with no place for anything identifying. */
export interface WireEvent {
  event: EventName;
  path: string;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  referrer: ReferrerClass;
  props: Record<string, string>;
}

const pathPattern = /^\/(?:[a-z0-9._~-]+(?:\/[a-z0-9._~-]+){0,4})?\/?$/i;

export type ValidationResult = { ok: true; event: WireEvent } | { ok: false; reason: string };

/** Strict validation at the trust boundary: anything unexpected is rejected, never "cleaned up" and stored. */
export function validateWireEvent(input: unknown): ValidationResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return { ok: false, reason: "not an object" };
  const record = input as Record<string, unknown>;
  const allowedKeys = new Set(["event", "path", "source", "medium", "campaign", "referrer", "props"]);
  for (const key of Object.keys(record)) if (!allowedKeys.has(key)) return { ok: false, reason: `unexpected field "${key}"` };

  const name = record.event;
  if (typeof name !== "string" || !Object.hasOwn(EVENTS, name)) return { ok: false, reason: "unknown event" };
  const definition = EVENTS[name as EventName] as EventDefinition;

  const path = record.path;
  if (typeof path !== "string" || path.length > 120 || !pathPattern.test(path) || path.split("/").some((segment) => /^\.+$/.test(segment)))
    return { ok: false, reason: "invalid path" };

  const attribution: Record<"source" | "medium" | "campaign", string | null> = { source: null, medium: null, campaign: null };
  for (const key of ["source", "medium", "campaign"] as const) {
    const value = record[key];
    if (value === null || value === undefined) continue;
    if (typeof value !== "string" || sanitizeUtm(value) !== value) return { ok: false, reason: `invalid ${key}` };
    attribution[key] = value;
  }

  const referrer = record.referrer;
  if (typeof referrer !== "string" || !(referrerClasses as readonly string[]).includes(referrer)) return { ok: false, reason: "invalid referrer class" };

  const rawProps = record.props ?? {};
  if (typeof rawProps !== "object" || rawProps === null || Array.isArray(rawProps)) return { ok: false, reason: "invalid props" };
  const props: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawProps)) {
    const rule = definition.props[key];
    if (!rule) return { ok: false, reason: `property "${key}" is not allowed for ${name}` };
    if (typeof value !== "string" || !rule.valid(value)) return { ok: false, reason: `invalid value for ${key}` };
    props[key] = value;
  }
  for (const [key, rule] of Object.entries(definition.props)) if (rule.required && !(key in props)) return { ok: false, reason: `missing ${key}` };

  return { ok: true, event: { event: name as EventName, path, ...attribution, referrer: referrer as ReferrerClass, props } };
}

export function stageOf(name: EventName): Stage {
  return (EVENTS[name] as EventDefinition).stage;
}

/** Stable aggregate key for one day of one distinct event shape. Contains nothing per-visitor. */
export function aggregateKey(day: string, event: WireEvent): string {
  const props = Object.entries(event.props)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  return ["m", day, event.event, event.path, event.source ?? "-", event.medium ?? "-", event.campaign ?? "-", event.referrer, props || "-"].join("|");
}

export function parseAggregateKey(key: string): (Omit<WireEvent, "props"> & { day: string; props: Record<string, string> }) | null {
  const parts = key.split("|");
  if (parts.length !== 9 || parts[0] !== "m") return null;
  const [, day, event, path, source, medium, campaign, referrer, props] = parts;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Object.hasOwn(EVENTS, event)) return null;
  const parsedProps: Record<string, string> = {};
  if (props !== "-")
    for (const pair of props.split("&")) {
      const [k, v] = pair.split("=");
      if (k && v) parsedProps[k] = v;
    }
  const candidate = {
    event,
    path,
    source: source === "-" ? null : source,
    medium: medium === "-" ? null : medium,
    campaign: campaign === "-" ? null : campaign,
    referrer,
    props: parsedProps
  };
  const checked = validateWireEvent(candidate);
  if (!checked.ok) return null;
  return { ...checked.event, day };
}
