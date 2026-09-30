export const profilePolicy = {
  githubUsername: "Thavarshan",
  featuredRepositoryCount: 5,
  excludedRepositories: ["thavarshan.com", "github-templates"],
  publicPhone: false,
  seoTopics: [
    "Technical leadership",
    "AI systems architecture",
    "Platform engineering",
    "Cloud architecture",
    "Full-stack engineering"
  ],
  skillCategories: {
    leadership: "Engineering Leadership",
    "ai-architecture": "AI & Architecture",
    "full-stack": "Full Stack",
    "cloud-delivery": "Cloud & Delivery"
  }
} as const;
