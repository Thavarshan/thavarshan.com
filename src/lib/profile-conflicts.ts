import type { ProfessionalProfile } from "@/lib/profile-schema";
import type { GitHubSnapshot } from "@/lib/github-model";

function comparable(value?: string | null) {
  return value?.toLowerCase().replace(/^@/, "").replace(/[^a-z0-9]+/g, " ").trim() ?? "";
}

export function findProfileConflicts(profile: ProfessionalProfile, github: GitHubSnapshot) {
  const warnings: string[] = [];
  const currentEmployer = profile.experience.find((item) => item.endDate === null)?.company;

  if (github.name && comparable(github.name) !== comparable(profile.identity.name)) {
    warnings.push(`GitHub name "${github.name}" differs from LinkedIn name "${profile.identity.name}"`);
  }
  if (github.location && comparable(github.location) !== comparable(profile.identity.location)) {
    warnings.push(`GitHub location "${github.location}" differs from LinkedIn location "${profile.identity.location}"`);
  }
  if (github.company && currentEmployer && !comparable(github.company).includes(comparable(currentEmployer))) {
    warnings.push(`GitHub company "${github.company}" differs from current LinkedIn employer "${currentEmployer}"`);
  }

  return warnings;
}
