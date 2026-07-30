import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import { Timeline } from "@/components/timeline";
import { experience } from "@/data/experience";

describe("Timeline", () => {
  it("renders the current LinkedIn-authoritative role first", () => {
    render(React.createElement(Timeline, { items: experience }));

    expect(screen.getAllByRole("article")[0]).toHaveTextContent("Sino Lanka Group");
    expect(screen.getByText("May 2026 - Present")).toBeInTheDocument();
  });
});
