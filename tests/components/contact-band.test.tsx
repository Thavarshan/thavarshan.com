import { fireEvent, render, screen, within } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContactBand } from "@/components/layout/contact-band";
import { conversationHref, conversionProjects, conversionSkills } from "@/features/profile/conversion";
import { profile } from "@/features/profile/profile";
import { track } from "@/features/telemetry/client";

vi.mock("next/navigation", () => ({ usePathname: () => "/projects/fetch-php" }));
vi.mock("@/features/telemetry/client", () => ({ track: vi.fn() }));
beforeEach(() => vi.clearAllMocks());

describe("hiring and consulting journeys", () => {
  it("exposes labelled evidence, CV and enquiry paths for both audiences", () => {
    render(React.createElement(ContactBand));
    const hiring = screen.getByRole("region", { name: "Hiring an engineer?" });
    const consulting = screen.getByRole("region", { name: "Have a project to discuss?" });
    expect(within(hiring).getByRole("link", { name: "Full CV" })).toHaveAttribute("href", "/cv");
    expect(within(hiring).getByRole("link", { name: "Career experience" })).toHaveAttribute("href", "/#experience");
    expect(within(hiring).getByRole("link", { name: "Discuss a role" })).toHaveAttribute("href", conversationHref("hiring"));
    expect(within(consulting).getByRole("link", { name: "Discuss a project" })).toHaveAttribute("href", conversationHref("consulting"));
    for (const project of conversionProjects)
      expect(within(consulting).getByRole("link", { name: project.name })).toHaveAttribute("href", `/projects/${project.repository}`);
  });
  it.each([
    ["Discuss a role", "hire_cta"],
    ["Discuss a project", "consulting_cta"]
  ])("counts %s exactly once with page location only", (label, event) => {
    render(React.createElement(ContactBand));
    const link = screen.getByRole("link", { name: label });
    link.addEventListener("click", (e) => e.preventDefault());
    fireEvent.click(link);
    expect(track).toHaveBeenCalledExactlyOnceWith(event, { location: "projects" });
  });
  it("does not count an evidence link as a contact conversion", () => {
    render(React.createElement(ContactBand));
    const link = screen.getByRole("link", { name: "Full CV" });
    link.addEventListener("click", (e) => e.preventDefault());
    fireEvent.click(link);
    expect(track).not.toHaveBeenCalled();
  });
  it("derives advertised skills from the verified profile", () => {
    expect(conversionSkills).toEqual(expect.arrayContaining(["Laravel", "PHP", "AWS"]));
    for (const name of conversionSkills) expect(profile.skills.some((skill) => skill.name === name)).toBe(true);
  });
  it("keeps fixed briefs in the email client rather than submitting a form", () => {
    for (const intent of ["hiring", "consulting"] as const) {
      const url = new URL(conversationHref(intent));
      expect(url.protocol).toBe("mailto:");
      expect(url.pathname).toBe(profile.identity.email);
      expect(url.searchParams.get("subject")).toContain("conversation");
      expect(url.searchParams.get("body")).toContain("Hello Jerome");
    }
  });
});
