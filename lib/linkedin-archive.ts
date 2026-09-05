import { createHash } from "node:crypto";
import { basename } from "node:path";
import { parse } from "csv-parse/sync";
import { strFromU8, unzipSync } from "fflate";
import type {
  CertificationRecord,
  EducationRecord,
  ExperienceRecord,
  LanguageRecord,
  ProfessionalProfile,
  ProfessionalProject,
  SkillRecord
} from "@/lib/profile-schema";
import { parseProfessionalProfile } from "@/lib/profile-schema";

const MAX_ARCHIVE_BYTES = 50 * 1024 * 1024;
const MAX_SELECTED_FILE_BYTES = 5 * 1024 * 1024;
const MAX_SELECTED_TOTAL_BYTES = 20 * 1024 * 1024;

const knownFiles = new Set([
  "profile.csv",
  "positions.csv",
  "education.csv",
  "skills.csv",
  "certifications.csv",
  "projects.csv",
  "languages.csv"
]);

type CsvRow = Record<string, string>;

export type LinkedInImportResult = {
  profile: ProfessionalProfile;
  importedSections: string[];
  warnings: string[];
};

function normalizeHeader(header: string) {
  return header.toLowerCase().replace(/^\uFEFF/, "").replace(/[^a-z0-9]+/g, "");
}

function parseCsv(contents: Uint8Array, filename: string): CsvRow[] {
  try {
    return parse(strFromU8(contents), {
      bom: true,
      columns: (headers: string[]) => headers.map(normalizeHeader),
      relax_column_count: true,
      skip_empty_lines: true,
      trim: true
    }) as CsvRow[];
  } catch (error) {
    throw new Error(`Unable to parse ${filename}: ${error instanceof Error ? error.message : "invalid CSV"}`, {
      cause: error
    });
  }
}

function value(row: CsvRow, ...aliases: string[]) {
  for (const alias of aliases) {
    const result = row[normalizeHeader(alias)]?.trim();

    if (result) {
      return result;
    }
  }

  return undefined;
}

function assertNamedRows(rows: CsvRow[], filename: string, ...aliases: string[]) {
  const normalizedAliases = aliases.map(normalizeHeader);
  const hasExpectedColumn = rows.some((row) => normalizedAliases.some((alias) => alias in row));

  if (!hasExpectedColumn) {
    throw new Error(`${filename} is missing a required ${aliases[0]} column`);
  }

  if (rows.some((row) => !value(row, ...aliases))) {
    throw new Error(`${filename} contains a row without a ${aliases[0]}`);
  }
}

function slugify(valueToSlug: string) {
  return valueToSlug
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function normalizeLinkedInDate(input?: string) {
  const valueToNormalize = input?.trim();

  if (!valueToNormalize) {
    return undefined;
  }

  const yearMonthMatch = valueToNormalize.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/);
  if (yearMonthMatch) {
    const month = Number(yearMonthMatch[2]);
    if (month >= 1 && month <= 12) {
      return `${yearMonthMatch[1]}-${String(month).padStart(2, "0")}`;
    }
  }

  const monthYearMatch = valueToNormalize.match(/^(\d{1,2})[/-](\d{4})$/);
  if (monthYearMatch) {
    const month = Number(monthYearMatch[1]);
    if (month >= 1 && month <= 12) {
      return `${monthYearMatch[2]}-${String(month).padStart(2, "0")}`;
    }
  }

  const parsed = new Date(valueToNormalize);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
  }

  if (/^\d{4}$/.test(valueToNormalize)) {
    return `${valueToNormalize}-01`;
  }

  throw new Error(`Unsupported LinkedIn date "${valueToNormalize}"`);
}

export function splitLinkedInDescription(description?: string) {
  const normalized = description?.replace(/\r\n?/g, "\n").trim();
  if (!normalized) {
    return { summary: "", highlights: [] as string[] };
  }

  const lineItems = normalized
    .split(/\n+/)
    .map((line) => line.replace(/^\s*(?:[-*•▪◦]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);
  const items =
    lineItems.length > 1
      ? lineItems
      : normalized
          .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
          .map((sentence) => sentence.trim())
          .filter(Boolean);

  return {
    summary: items[0] ?? normalized,
    highlights: items.length > 1 ? items.slice(1, 5) : []
  };
}

function categoryForSkill(name: string, previous: ProfessionalProfile): SkillRecord["category"] {
  const known = previous.skills.find((skill) => skill.name.toLowerCase() === name.toLowerCase());
  if (known) {
    return known.category;
  }

  if (/lead|mentor|management|strategy|planning|architecture review|product/i.test(name)) {
    return "leadership";
  }
  if (/ai|llm|langgraph|machine learning|semantic|vector|microservice|architecture|event|api design/i.test(name)) {
    return "ai-architecture";
  }
  if (/aws|azure|gcp|cloud|docker|kubernetes|terraform|ci\/?cd|devops|observability|datadog/i.test(name)) {
    return "cloud-delivery";
  }
  return "full-stack";
}

function importExperience(rows: CsvRow[]): ExperienceRecord[] {
  return rows
    .map((row) => {
      const role = value(row, "Title", "Role");
      const company = value(row, "Company Name", "Company");
      const startDate = normalizeLinkedInDate(value(row, "Started On", "Start Date", "Start Date (Month/Year)"));

      if (!role || !company || !startDate) {
        throw new Error("Positions.csv contains a row without a title, company, or start date");
      }

      const endDate = normalizeLinkedInDate(value(row, "Finished On", "End Date", "End Date (Month/Year)")) ?? null;
      const description = splitLinkedInDescription(value(row, "Description"));

      return {
        id: slugify(`${company}-${role}-${startDate}`),
        role,
        company,
        ...(value(row, "Location") ? { location: value(row, "Location") } : {}),
        startDate,
        endDate,
        summary: description.summary,
        highlights: description.highlights
      };
    })
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
}

function importEducation(rows: CsvRow[]): EducationRecord[] {
  return rows.map((row) => {
    const institution = value(row, "School Name", "School", "Institution");
    const qualification = value(row, "Degree Name", "Degree", "Qualification") ?? value(row, "Field Of Study");

    if (!institution || !qualification) {
      throw new Error("Education.csv contains a row without a school or qualification");
    }

    const startDate = normalizeLinkedInDate(value(row, "Start Date", "Started On"));
    const endDate = normalizeLinkedInDate(value(row, "End Date", "Finished On"));

    return {
      id: slugify(`${institution}-${qualification}`),
      qualification,
      institution,
      ...(value(row, "Field Of Study") ? { fieldOfStudy: value(row, "Field Of Study") } : {}),
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
      ...(value(row, "Notes", "Description") ? { summary: value(row, "Notes", "Description") } : {})
    };
  });
}

function importCertifications(rows: CsvRow[]): CertificationRecord[] {
  return rows.map((row) => {
    const name = value(row, "Name", "Certification Name");
    if (!name) {
      throw new Error("Certifications.csv contains a row without a name");
    }

    const issuedDate = normalizeLinkedInDate(value(row, "Started On", "Issue Date"));
    const expiresDate = normalizeLinkedInDate(value(row, "Finished On", "Expiration Date"));
    const credentialUrl = value(row, "Url", "Credential URL");

    return {
      id: slugify(name),
      name,
      ...(value(row, "Authority", "Issuing Organization") ? { authority: value(row, "Authority", "Issuing Organization") } : {}),
      ...(issuedDate ? { issuedDate } : {}),
      ...(expiresDate ? { expiresDate } : {}),
      ...(credentialUrl ? { credentialUrl } : {})
    };
  });
}

function importProjects(rows: CsvRow[]): ProfessionalProject[] {
  return rows.map((row) => {
    const name = value(row, "Title", "Name");
    const descriptionText = value(row, "Description");
    if (!name || !descriptionText) {
      throw new Error("Projects.csv contains a row without a name or description");
    }

    const description = splitLinkedInDescription(descriptionText);
    const startDate = normalizeLinkedInDate(value(row, "Started On", "Start Date"));
    const endDate = normalizeLinkedInDate(value(row, "Finished On", "End Date"));

    return {
      id: slugify(name),
      name,
      role: "Creator and builder",
      description: description.summary,
      highlights: description.highlights,
      tags: [],
      ...(value(row, "Url", "URL") ? { url: value(row, "Url", "URL") } : {}),
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {})
    };
  });
}

export function importLinkedInArchive(
  archive: Uint8Array,
  previous: ProfessionalProfile,
  options: { now?: Date } = {}
): LinkedInImportResult {
  if (archive.byteLength === 0 || archive.byteLength > MAX_ARCHIVE_BYTES) {
    throw new Error(`LinkedIn archive must be between 1 byte and ${MAX_ARCHIVE_BYTES} bytes`);
  }

  let selectedTotal = 0;
  let unsafePath: string | undefined;
  const files = unzipSync(archive, {
    filter(file) {
      if (file.name.startsWith("/") || file.name.split(/[\\/]/).includes("..")) {
        unsafePath = file.name;
        return false;
      }

      const filename = basename(file.name).toLowerCase();
      if (!knownFiles.has(filename)) {
        return false;
      }
      if (file.originalSize > MAX_SELECTED_FILE_BYTES) {
        throw new Error(`${file.name} exceeds the safe LinkedIn CSV size limit`);
      }

      selectedTotal += file.originalSize;
      if (selectedTotal > MAX_SELECTED_TOTAL_BYTES) {
        throw new Error("Selected LinkedIn CSV files exceed the safe extraction limit");
      }
      return true;
    }
  });

  if (unsafePath) {
    throw new Error(`LinkedIn archive contains an unsafe path: ${unsafePath}`);
  }

  const rowsByFile = new Map<string, CsvRow[]>();
  for (const [path, contents] of Object.entries(files)) {
    rowsByFile.set(basename(path).toLowerCase(), parseCsv(contents, basename(path)));
  }

  if (rowsByFile.size === 0) {
    throw new Error("No supported LinkedIn profile CSV files were found in the archive");
  }

  const next: ProfessionalProfile = structuredClone(previous);
  const warnings: string[] = [];
  const importedSections: string[] = [];
  const profileRows = rowsByFile.get("profile.csv");

  if (profileRows) {
    const row = profileRows[0];
    if (!row) {
      throw new Error("Profile.csv is empty");
    }
    const givenName = value(row, "First Name") ?? next.identity.givenName;
    const familyName = value(row, "Last Name") ?? next.identity.familyName;
    next.identity = {
      ...next.identity,
      givenName,
      familyName,
      name: `${givenName} ${familyName}`.trim(),
      headline: value(row, "Headline") ?? next.identity.headline,
      location: value(row, "Geo Location", "Location") ?? next.identity.location
    };
    next.summary = value(row, "Summary") ?? next.summary;
    importedSections.push("profile");
  }

  const positions = rowsByFile.get("positions.csv");
  if (positions) {
    next.experience = importExperience(positions);
    importedSections.push("experience");
  }

  const education = rowsByFile.get("education.csv");
  if (education) {
    next.education = importEducation(education);
    importedSections.push("education");
  }

  const certifications = rowsByFile.get("certifications.csv");
  if (certifications) {
    next.certifications = importCertifications(certifications);
    importedSections.push("certifications");
  }

  const skills = rowsByFile.get("skills.csv");
  if (skills) {
    assertNamedRows(skills, "Skills.csv", "Name", "Skill Name");
    next.skills = skills
      .map((row) => value(row, "Name", "Skill Name"))
      .filter((name): name is string => Boolean(name))
      .map((name) => ({ name, category: categoryForSkill(name, previous) }));
    importedSections.push("skills");
  }

  const languages = rowsByFile.get("languages.csv");
  if (languages) {
    assertNamedRows(languages, "Languages.csv", "Name", "Language");
    next.languages = languages
      .map<LanguageRecord | null>((row) => {
        const name = value(row, "Name", "Language");
        return name
          ? {
              name,
              ...(value(row, "Proficiency") ? { proficiency: value(row, "Proficiency") } : {})
            }
          : null;
      })
      .filter((language): language is LanguageRecord => language !== null);
    importedSections.push("languages");
  }

  const projects = rowsByFile.get("projects.csv");
  if (projects) {
    next.professionalProjects = importProjects(projects);
    importedSections.push("professionalProjects");
  }

  for (const section of ["profile", "experience", "education", "certifications", "skills", "languages", "professionalProjects"]) {
    if (!importedSections.includes(section)) {
      warnings.push(`${section} was not present and has been preserved from the previous profile`);
    }
  }

  const now = options.now ?? new Date();
  next.sources.linkedin = {
    kind: "linkedin-archive",
    importedAt: now.toISOString(),
    fingerprint: createHash("sha256").update(archive).digest("hex")
  };
  next.modifiedAt = now.toISOString();

  return {
    profile: parseProfessionalProfile(next),
    importedSections,
    warnings
  };
}
