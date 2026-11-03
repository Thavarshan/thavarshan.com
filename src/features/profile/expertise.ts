import { profilePolicy } from "@/shared/config/profile-policy";
import { profile } from "@/features/profile/profile";

export type ExpertiseGroup = {
  title: string;
  summary: string;
  items: string[];
};

const summaries = {
  "genai-ml": "LLM workflows, retrieval, embeddings, semantic search, and applied machine learning.",
  backend: "APIs and application services across Node.js, Java, Python, and PHP.",
  frontend: "Modern web interfaces and full-stack product development with React, Next.js, and Vue.",
  data: "Relational, document, cache, and cloud databases for production applications.",
  "cloud-delivery": "Cloud infrastructure, containers, automation, and reliable delivery practices.",
  engineering: "System design, observability, code review, and automated quality checks."
} as const;

export const expertiseGroups: ExpertiseGroup[] = Object.entries(profilePolicy.skillCategories).map(([category, title]) => ({
  title,
  summary: summaries[category as keyof typeof summaries],
  items: profile.skills.filter((skill) => skill.category === category).map((skill) => skill.name)
}));
