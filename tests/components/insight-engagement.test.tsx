import { render } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { InsightEngagement } from "@/components/insight-engagement";

describe("InsightEngagement", () => {
  it("does nothing when analytics is unavailable", () => {
    expect(() => render(React.createElement(InsightEngagement, { slug: "test" }))).not.toThrow();
  });

  it("tracks a 75 percent read once when Plausible is available", () => {
    const plausible = vi.fn();
    window.plausible = plausible;
    Object.defineProperty(document.documentElement, "scrollHeight", { configurable: true, value: 2000 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 1000 });
    Object.defineProperty(window, "scrollY", { configurable: true, value: 800 });

    render(React.createElement(InsightEngagement, { slug: "test" }));
    window.dispatchEvent(new Event("scroll"));
    window.dispatchEvent(new Event("scroll"));

    expect(plausible).toHaveBeenCalledTimes(1);
    expect(plausible).toHaveBeenCalledWith("Insight 75% Read", { props: { slug: "test" } });
    delete window.plausible;
  });
});
