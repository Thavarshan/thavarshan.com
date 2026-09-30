import { attributionFromSearch, classifyReferrer, eventNames, validateWireEvent, type Attribution, type EventName, type ReferrerClass, type WireEvent } from "./events";

/**
 * Browser-side telemetry. Design rules:
 *  - never throw, never block the UI: every path is wrapped, and sending is fire-and-forget;
 *  - honour Do Not Track and Global Privacy Control by doing nothing at all;
 *  - no cookies, no localStorage, no visitor/session identifier, no fingerprinting. The ONLY thing kept
 *    is the landing attribution (utm_* and a referrer class) in sessionStorage so a click on a later
 *    page can still be credited to how the visitor arrived; it is four short strings and dies with the tab;
 *  - the same events go to every enabled sink (first-party collector, and Plausible if configured).
 */

export interface TelemetryConfig {
  /** First-party collector endpoint; telemetry is a no-op toward it when empty. */
  endpoint: string;
  /** Hostname on which telemetry is active (the production site). */
  activeHost: string;
  /** Also active on other hosts (local development, end-to-end tests). */
  activeEverywhere: boolean;
}

const STORAGE_KEY = "ge.attribution";

interface SessionAttribution extends Attribution {
  referrer: ReferrerClass;
}

let config: TelemetryConfig = { endpoint: "", activeHost: "", activeEverywhere: false };
const recent = new Map<string, number>();
const fired = new Set<string>();

export function configureTelemetry(next: TelemetryConfig) {
  config = next;
}

export function resetTelemetryForTests() {
  recent.clear();
  fired.clear();
}

/** True when the visitor has asked not to be tracked. Checked on every event, not cached. */
export function privacySignalOn(nav: Pick<Navigator, "doNotTrack"> & { globalPrivacyControl?: boolean } = navigator): boolean {
  return nav.doNotTrack === "1" || nav.globalPrivacyControl === true;
}

function readSessionAttribution(): SessionAttribution | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SessionAttribution>;
    const checked = validateWireEvent({ event: "newsletter_click", path: "/", source: parsed.source ?? null, medium: parsed.medium ?? null, campaign: parsed.campaign ?? null, referrer: parsed.referrer, props: {} });
    return checked.ok ? { source: checked.event.source, medium: checked.event.medium, campaign: checked.event.campaign, referrer: checked.event.referrer } : null;
  } catch {
    return null;
  }
}

/** Records the landing attribution for the tab, but only when telemetry is active; with a privacy signal it touches nothing. */
export function captureLandingAttribution() {
  try {
    if (active()) getSessionAttribution();
  } catch {
    // Attribution is best-effort.
  }
}

/** Captured once per tab session from the landing URL; later pages reuse it. */
export function getSessionAttribution(): SessionAttribution {
  const stored = readSessionAttribution();
  if (stored) return stored;

  const fromUrl = attributionFromSearch(location.search);
  const current: SessionAttribution = { ...fromUrl, referrer: classifyReferrer(document.referrer, location.hostname) };
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Storage can be blocked (private modes, strict settings); attribution then applies to this page only.
  }
  return current;
}

function active(): boolean {
  if (typeof window === "undefined") return false;
  if (privacySignalOn()) return false;
  return config.activeEverywhere || location.hostname === config.activeHost;
}

function send(url: string, body: string) {
  try {
    if (typeof navigator.sendBeacon === "function" && navigator.sendBeacon(url, new Blob([body], { type: "text/plain" }))) return;
  } catch {
    // fall through to fetch
  }
  try {
    void fetch(url, { method: "POST", body, keepalive: true, mode: "no-cors", credentials: "omit", headers: { "Content-Type": "text/plain" } }).catch(() => undefined);
  } catch {
    // Blocked or offline: dropping the event is the correct behaviour.
  }
}

export interface TrackOptions {
  /** Send at most once per page view (for "completed" style events). */
  once?: boolean;
}

/** Records one event. Safe to call anywhere, any number of times; returns whether it was sent. */
export function track(name: EventName, props: Record<string, string> = {}, options: TrackOptions = {}): boolean {
  try {
    if (!active() || !eventNames.includes(name)) return false;

    const dedupeKey = `${name}|${JSON.stringify(props)}|${location.pathname}`;
    if (options.once) {
      if (fired.has(dedupeKey)) return false;
      fired.add(dedupeKey);
    }
    const now = Date.now();
    if (now - (recent.get(dedupeKey) ?? 0) < 1000) return false; // double clicks
    recent.set(dedupeKey, now);

    const attribution = getSessionAttribution();
    const event: WireEvent = {
      event: name,
      path: location.pathname.length > 1 ? location.pathname.replace(/\/$/, "") : location.pathname,
      source: attribution.source,
      medium: attribution.medium,
      campaign: attribution.campaign,
      referrer: attribution.referrer,
      props
    };

    // Never send something the collector would reject, and never send an event that fails our own rules.
    const checked = validateWireEvent(event);
    if (!checked.ok) return false;

    if (config.endpoint) send(config.endpoint, JSON.stringify(checked.event));
    const plausible = (window as unknown as { plausible?: (eventName: string, options?: { props?: Record<string, string> }) => void }).plausible;
    if (typeof plausible === "function") plausible(name, { props });
    return true;
  } catch {
    return false;
  }
}
