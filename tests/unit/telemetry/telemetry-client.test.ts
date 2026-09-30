import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  captureLandingAttribution,
  configureTelemetry,
  getSessionAttribution,
  privacySignalOn,
  resetTelemetryForTests,
  track
} from "@/features/telemetry/client";
import { validateWireEvent } from "@/features/telemetry/events";

const ENDPOINT = "https://collector.example/collect";
const readBlob = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsText(blob);
  });

function setNavigator(values: Record<string, unknown>) {
  for (const [key, value] of Object.entries(values)) Object.defineProperty(navigator, key, { configurable: true, value });
}

beforeEach(() => {
  resetTelemetryForTests();
  sessionStorage.clear();
  window.history.replaceState({}, "", "/projects/fetch-php");
  configureTelemetry({ endpoint: ENDPOINT, activeHost: "localhost", activeEverywhere: false });
  setNavigator({ doNotTrack: null, globalPrivacyControl: undefined, sendBeacon: vi.fn(() => true) });
  delete (window as unknown as { plausible?: unknown }).plausible;
});
afterEach(() => vi.restoreAllMocks());

const beacon = () => navigator.sendBeacon as unknown as ReturnType<typeof vi.fn>;

describe("track", () => {
  it("sends a valid, minimal, identifier-free payload via sendBeacon as text/plain (no CORS preflight)", async () => {
    expect(track("repo_click", { project: "fetch-php" })).toBe(true);
    const [url, blob] = beacon().mock.calls[0] as [string, Blob];
    expect(url).toBe(ENDPOINT);
    expect(blob.type).toBe("text/plain");
    const payload = JSON.parse(await readBlob(blob));
    expect(validateWireEvent(payload).ok).toBe(true);
    expect(payload).toEqual({
      event: "repo_click",
      path: "/projects/fetch-php",
      source: null,
      medium: null,
      campaign: null,
      referrer: "direct",
      props: { project: "fetch-php" }
    });
    expect(Object.keys(payload).sort()).toEqual(["campaign", "event", "medium", "path", "props", "referrer", "source"]);
  });

  it("never sets cookies or writes anything except the four-string attribution record", () => {
    track("cv_download", { location: "home" });
    expect(document.cookie).toBe("");
    expect(Object.keys(localStorage)).toEqual([]);
    expect(Object.keys(sessionStorage)).toEqual(["ge.attribution"]);
    expect(Object.keys(JSON.parse(sessionStorage.getItem("ge.attribution")!)).sort()).toEqual(["campaign", "medium", "referrer", "source"]);
  });

  it("does nothing at all when Do Not Track or Global Privacy Control is on", () => {
    setNavigator({ doNotTrack: "1" });
    expect(privacySignalOn()).toBe(true);
    expect(track("cv_download", { location: "home" })).toBe(false);
    setNavigator({ doNotTrack: null, globalPrivacyControl: true });
    expect(track("cv_download", { location: "home" })).toBe(false);
    expect(beacon()).not.toHaveBeenCalled();
    expect(Object.keys(sessionStorage)).toEqual([]);
  });

  it("PRIVACY: with a privacy signal on, landing capture writes nothing to storage either", () => {
    window.history.replaceState({}, "", "/?utm_source=linkedin&utm_campaign=x");
    setNavigator({ doNotTrack: "1" });
    captureLandingAttribution();
    expect(Object.keys(sessionStorage)).toEqual([]);
    setNavigator({ doNotTrack: null, globalPrivacyControl: true });
    captureLandingAttribution();
    expect(Object.keys(sessionStorage)).toEqual([]);
    setNavigator({ globalPrivacyControl: undefined });
    configureTelemetry({ endpoint: ENDPOINT, activeHost: "thavarshan.com", activeEverywhere: false });
    captureLandingAttribution(); // inactive host
    expect(Object.keys(sessionStorage)).toEqual([]);
    configureTelemetry({ endpoint: ENDPOINT, activeHost: "localhost", activeEverywhere: false });
    captureLandingAttribution();
    expect(Object.keys(sessionStorage)).toEqual(["ge.attribution"]);
  });

  it("is inert on other hosts unless explicitly enabled, and with no endpoint", () => {
    configureTelemetry({ endpoint: ENDPOINT, activeHost: "thavarshan.com", activeEverywhere: false });
    expect(track("cv_download", { location: "home" })).toBe(false);
    configureTelemetry({ endpoint: "", activeHost: "localhost", activeEverywhere: false });
    expect(track("cv_download", { location: "home" })).toBe(true);
    expect(beacon()).not.toHaveBeenCalled();
  });

  it("refuses events the collector would reject, instead of sending junk", () => {
    expect(track("repo_click", { project: "Not A Slug!" })).toBe(false);
    expect(track("repo_click", {})).toBe(false);
    expect(track("nonsense" as never)).toBe(false);
    expect(beacon()).not.toHaveBeenCalled();
  });

  it("drops double clicks within a second and supports once-per-page-view", () => {
    expect(track("cv_download", { location: "home" })).toBe(true);
    expect(track("cv_download", { location: "home" })).toBe(false);
    expect(track("tool_completed", { tool: "laravel-env-checker" }, { once: true })).toBe(true);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 5000);
    expect(track("tool_completed", { tool: "laravel-env-checker" }, { once: true })).toBe(false);
    vi.useRealTimers();
  });

  it("falls back to fetch keepalive when sendBeacon is unavailable or refuses", () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null)));
    vi.stubGlobal("fetch", fetchMock);
    setNavigator({ sendBeacon: vi.fn(() => false) });
    track("cv_download", { location: "home" });
    expect(fetchMock).toHaveBeenCalledWith(ENDPOINT, expect.objectContaining({ method: "POST", keepalive: true, mode: "no-cors", credentials: "omit" }));
    vi.unstubAllGlobals();
  });

  it("RESILIENCE: analytics blocked, offline or throwing never breaks the page", () => {
    setNavigator({
      sendBeacon: vi.fn(() => {
        throw new Error("blocked by extension");
      })
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        throw new Error("blocked");
      })
    );
    expect(() => track("cv_download", { location: "home" })).not.toThrow();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("offline")))
    );
    setNavigator({ sendBeacon: undefined });
    expect(() => track("contact_cta", { location: "home" })).not.toThrow();
    vi.unstubAllGlobals();
  });

  it("RESILIENCE: blocked sessionStorage only loses cross-page attribution", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(() => track("cv_download", { location: "home" })).not.toThrow();
    expect(beacon()).toHaveBeenCalledTimes(1);
  });

  it("also reports to Plausible when it is present, with the same event and props only", () => {
    const plausible = vi.fn();
    (window as unknown as { plausible: typeof plausible }).plausible = plausible;
    track("repo_click", { project: "fetch-php" });
    expect(plausible).toHaveBeenCalledWith("repo_click", { props: { project: "fetch-php" } });
  });
});

describe("attribution", () => {
  it("captures UTM from the landing URL once and credits later pages in the same tab", async () => {
    window.history.replaceState({}, "", "/insights/x?utm_source=LinkedIn&utm_medium=social&utm_campaign=release-fetch-php-3-9-0");
    track("insight_read", { slug: "x" }, { once: true });
    window.history.replaceState({}, "", "/projects/fetch-php"); // navigation drops the query string
    track("repo_click", { project: "fetch-php" });
    const second = JSON.parse(await readBlob((beacon().mock.calls[1] as [string, Blob])[1]));
    expect(second).toMatchObject({ source: "linkedin", medium: "social", campaign: "release-fetch-php-3-9-0", path: "/projects/fetch-php" });
  });

  it("drops hostile UTM values rather than sending them, and classifies the referrer without keeping it", async () => {
    Object.defineProperty(document, "referrer", { configurable: true, value: "https://www.google.com/search?q=private+search" });
    window.history.replaceState({}, "", "/?utm_source=<script>&utm_campaign=ok");
    const attribution = getSessionAttribution();
    expect(attribution).toEqual({ source: null, medium: null, campaign: "ok", referrer: "search" });
    expect(JSON.stringify(attribution)).not.toContain("private");
    Object.defineProperty(document, "referrer", { configurable: true, value: "" });
  });

  it("ignores a tampered stored attribution record", () => {
    sessionStorage.setItem("ge.attribution", JSON.stringify({ source: "<img onerror=x>", medium: null, campaign: null, referrer: "direct" }));
    window.history.replaceState({}, "", "/?utm_campaign=fresh");
    expect(getSessionAttribution().campaign).toBe("fresh");
  });
});
