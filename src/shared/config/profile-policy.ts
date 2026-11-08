export const profilePolicy = {
  githubUsername: "Thavarshan",
  featuredRepositoryCount: 5,
  additionalFeaturedRepositories: ["dokimos"],
  excludedRepositories: ["thavarshan.com", "github-templates"],
  publicPhone: false,
  seoTopics: ["Technical leadership", "Generative AI", "Full-stack engineering", "Platform engineering", "Cloud architecture"],
  skillCategories: {
    "genai-ml": "Generative AI and ML",
    backend: "Backend engineering",
    frontend: "Frontend engineering",
    data: "Data and search",
    "cloud-delivery": "Cloud and delivery",
    engineering: "Technical leadership and engineering quality"
  }
} as const;
