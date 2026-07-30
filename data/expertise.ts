import { profilePolicy } from "@/data/profile-policy";
import { profile } from "@/data/profile";

export type ExpertiseGroup = {
  title: string;
  summary: string;
  items: string[];
};

const summaries = {
  leadership: "Technical direction, standards, mentoring, delivery planning, and cross-functional product collaboration.",
  "ai-architecture": "Workflow orchestration, system design, semantic search, event-driven systems, and scalable service boundaries.",
  "full-stack": "Modern frontend and backend engineering across typed applications, APIs, data stores, and product interfaces.",
  "cloud-delivery": "Production-minded infrastructure, observability, and release practices for distributed applications."
} as const;

export const expertiseGroups: ExpertiseGroup[] = Object.entries(profilePolicy.skillCategories).map(([category, title]) => ({
  title,
  summary: summaries[category as keyof typeof summaries],
  items: profile.skills.filter((skill) => skill.category === category).map((skill) => skill.name)
}));
