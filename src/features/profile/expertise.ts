import { profilePolicy } from "@/shared/config/profile-policy";
import { profile } from "@/features/profile/profile";

export type ExpertiseGroup = {
  title: string;
  summary: string;
  items: string[];
};

const summaries = {
  "genai-ml": "LangGraph workflows, retrieval, embeddings, and applied machine learning.",
  backend: "API gateways and application services across Node.js/TypeScript, Java/Spring Boot, Python, and PHP/Laravel.",
  frontend: "Full-stack product interfaces with React, Next.js, Vue, and TypeScript.",
  data: "Relational and document databases, caching, and semantic/vector search.",
  "cloud-delivery": "Cloud infrastructure, containers, and deployment pipelines across AWS and GCP.",
  engineering: "Technical leadership, system design, production reliability, observability, code review, and automated testing."
} as const;

export const expertiseGroups: ExpertiseGroup[] = Object.entries(profilePolicy.skillCategories).map(([category, title]) => ({
  title,
  summary: summaries[category as keyof typeof summaries],
  items: profile.skills.filter((skill) => skill.category === category).map((skill) => skill.name)
}));
