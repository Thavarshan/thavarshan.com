import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import { ProjectCard } from "@/components/project-card";
import { projectDefinitions } from "@/data/projects";

describe("ProjectCard", () => {
  it("renders repository stats and accessible links when stats exist", () => {
    render(
      React.createElement(ProjectCard, {
        project: {
          ...projectDefinitions[0],
          stats: {
            stars: 450,
            forks: 28,
            primaryLanguage: "PHP",
            url: "https://github.com/Thavarshan/fetch-php",
            lastUpdatedAt: "2026-01-01T00:00:00Z"
          }
        }
      })
    );

    expect(screen.getByRole("heading", { name: "Fetch PHP" })).toBeInTheDocument();
    expect(screen.getByLabelText("450 stars and 28 forks")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /repository/i })).toHaveAttribute("href", "https://github.com/Thavarshan/fetch-php");
  });

  it("renders curated content when stats are unavailable", () => {
    render(React.createElement(ProjectCard, { project: projectDefinitions[1] }));

    expect(screen.getByRole("heading", { name: "Laravel Filterable" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/stars and/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /repository/i })).toHaveAttribute("href", "https://github.com/Thavarshan/filterable");
  });
});
