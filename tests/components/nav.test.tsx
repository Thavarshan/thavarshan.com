import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import { SiteNav } from "@/components/site-nav";

describe("SiteNav", () => {
  it("exposes primary navigation and resume actions", () => {
    render(React.createElement(SiteNav));

    expect(screen.getByRole("navigation", { name: /primary/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /work/i })).toHaveAttribute("href", "/#projects");
    expect(screen.getByRole("link", { name: /resume/i })).toHaveAttribute("href", "/docs/Jerome-Resume.pdf");
  });
});
