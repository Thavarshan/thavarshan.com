export const profilePolicy = {
  githubUsername: "Thavarshan",
  featuredRepositoryCount: 5,
  excludedRepositories: ["thavarshan.com", "github-templates"],
  publicPhone: false,
  seoTopics: ["Technical leadership", "Generative AI", "Full-stack engineering", "Platform engineering", "Cloud architecture"],
  skillCategories: {
    "genai-ml": "GenAI and ML",
    backend: "Backend",
    frontend: "Frontend",
    data: "Data",
    "cloud-delivery": "Cloud and delivery",
    engineering: "Engineering"
  }
} as const;
