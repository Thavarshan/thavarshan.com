export type GitHubRepositoryStats = {
  stars: number;
  forks: number;
  primaryLanguage: string | null;
  url: string;
  lastUpdatedAt: string;
};

export type ProjectDefinition = {
  name: string;
  repository: string;
  role: string;
  summary: string;
  highlights: string[];
  tags: string[];
  homepage?: string;
  displayOrder: number;
};

export type FeaturedProject = ProjectDefinition & {
  stats?: GitHubRepositoryStats;
};

export type ProductProject = {
  name: string;
  role: string;
  url: string;
  homepage?: string;
  summary: string;
  highlights: string[];
  tags: string[];
};

import { profile } from "@/features/profile/profile";

const resumeHoneymelon = profile.resumeProjects?.find((project) => project.id === "honeymelon");
const primaryProduct = profile.professionalProjects.find((project) => project.id === "honeymelon") ?? profile.professionalProjects[0];

export const honeymelon: ProductProject = {
  name: primaryProduct.name,
  role: resumeHoneymelon?.role ?? primaryProduct.role,
  url: primaryProduct.url ?? profile.identity.website,
  summary: resumeHoneymelon?.description ?? primaryProduct.description,
  highlights: resumeHoneymelon?.highlights ?? primaryProduct.highlights,
  tags: resumeHoneymelon?.tags ?? primaryProduct.tags
};

export const projectDefinitions: ProjectDefinition[] = [
  {
    name: "Fetch PHP",
    repository: "fetch-php",
    role: "Creator and maintainer",
    summary: "A PHP package that brings a familiar fetch-style HTTP client experience to PHP developers.",
    highlights: [
      "Built around developer experience, predictable request handling, and approachable documentation.",
      "The strongest public adoption signal in the portfolio."
    ],
    tags: ["PHP", "HTTP", "Developer experience", "Open source"],
    homepage: "https://fetch-php.thavarshan.com",
    displayOrder: 1
  },
  {
    name: "Laravel Filterable",
    repository: "filterable",
    role: "Creator and maintainer",
    summary: "A Laravel package for clean, reusable filtering patterns across API and product query surfaces.",
    highlights: [
      "Turns repetitive filtering logic into structured, testable application code.",
      "Useful for teams shipping admin panels, dashboards, and data-heavy products."
    ],
    tags: ["Laravel", "PHP", "APIs", "Query design"],
    displayOrder: 2
  },
  {
    name: "phpvm",
    repository: "phpvm",
    role: "Creator and maintainer",
    summary: "A lightweight PHP version manager for developers who need fast local switching without heavyweight setup.",
    highlights: [
      "Focuses on practical local developer workflows and installation ergonomics.",
      "Shows systems scripting, release discipline, and tooling empathy."
    ],
    tags: ["Shell", "PHP", "CLI", "Tooling"],
    displayOrder: 3
  },
  {
    name: "Honeymelon (formerly Comet)",
    repository: "honeymelon",
    role: "Creator and maintainer",
    summary: "A TypeScript/Electron converter with a React interface in beta, local FFmpeg processing, shared packages and Playwright tests.",
    highlights: ["Stable releases retain the previous interface; the React interface is in the beta line.", "Converts media locally without uploads."],
    tags: ["TypeScript", "Electron", "React", "Node.js", "FFmpeg", "Playwright"],
    displayOrder: 4
  },
  {
    name: "Matrix",
    repository: "matrix",
    role: "Creator and maintainer",
    summary: "Event-driven asynchronous helpers for ReactPHP, including promise composition, cancellation, timeouts and concurrency limits.",
    highlights: ["Includes retries, rate limiting, events and metrics.", "Uses nonblocking work on a single event loop."],
    tags: ["PHP", "ReactPHP", "Async", "Concurrency"],
    displayOrder: 5
  },
  {
    name: "Dokimos",
    repository: "dokimos",
    role: "Creator and maintainer",
    summary: "A Python CLI for plagiarism evidence discovery and heuristic AI-likeness analysis with structured reports.",
    highlights: ["Ingests text, Markdown, DOCX and PDF documents.", "AI-likeness scores are heuristic signals, not proof of authorship."],
    tags: ["Python", "Pydantic", "CLI", "Document ingestion"],
    displayOrder: 6
  }
];
