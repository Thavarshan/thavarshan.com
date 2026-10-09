import githubData from "@generated/github.generated.json";
import { githubSnapshotSchema } from "@/features/github/github-model";
import { profile } from "@/features/profile/profile";

const snapshot = githubSnapshotSchema.parse(githubData);
export const conversionSkills = ["Laravel", "PHP", "AWS", "React.js", "Vue.js"].filter((name) => profile.skills.some((skill) => skill.name === name));
export const conversionProjects = snapshot.projects.filter((project) => ["fetch-php", "filterable"].includes(project.repository));

/** Fixed prompts stay in the visitor's email client and never enter telemetry. */
export function conversationHref(intent: "hiring" | "consulting") {
  const subject = intent === "hiring" ? "Hiring conversation" : "Consulting conversation";
  const body =
    intent === "hiring"
      ? "Hello Jerome,\n\nI'd like to discuss an engineering role.\n\nCompany and role:\nStack and responsibilities:\nLocation / remote arrangements:\n\n"
      : "Hello Jerome,\n\nI'd like to discuss an engineering project.\n\nProblem or goal:\nCurrent stack:\nScope and timeline:\n\n";
  return `mailto:${profile.identity.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
