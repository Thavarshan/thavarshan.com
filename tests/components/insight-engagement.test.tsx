import { render } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InsightEngagement } from "@/components/insight-engagement";
import { configureTelemetry, resetTelemetryForTests } from "@/lib/telemetry/client";

const readBlob = (blob: Blob) => new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsText(blob); });

describe("InsightEngagement", () => {
  const beacon = vi.fn(() => true);

  beforeEach(() => {
    resetTelemetryForTests();
    sessionStorage.clear();
    Object.defineProperty(navigator, "sendBeacon", { configurable: true, value: beacon });
    configureTelemetry({ endpoint: "https://collector.example/collect", activeHost: "localhost", activeEverywhere: true });
  });
  afterEach(() => beacon.mockClear());

  it("does nothing harmful when telemetry is unavailable", () => {
    configureTelemetry({ endpoint: "", activeHost: "elsewhere.example", activeEverywhere: false });
    expect(() => render(React.createElement(InsightEngagement, { slug: "test" }))).not.toThrow();
    expect(beacon).not.toHaveBeenCalled();
  });

  it("records a 75 percent read once, with only the slug", async () => {
    Object.defineProperty(document.documentElement, "scrollHeight", { configurable: true, value: 2000 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 1000 });
    Object.defineProperty(window, "scrollY", { configurable: true, value: 800 });

    render(React.createElement(InsightEngagement, { slug: "test" }));
    window.dispatchEvent(new Event("scroll"));
    window.dispatchEvent(new Event("scroll"));

    expect(beacon).toHaveBeenCalledTimes(1);
    const [url, blob] = beacon.mock.calls[0] as unknown as [string, Blob];
    expect(url).toBe("https://collector.example/collect");
    expect(JSON.parse(await readBlob(blob))).toMatchObject({ event: "insight_read", props: { slug: "test" } });
  });
});
