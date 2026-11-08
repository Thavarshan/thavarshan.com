import type { SanitizedCvTailoringPlan } from "@/features/cv/tailoring";
import type { GitHubSnapshot } from "@/features/github/github-model";
import type { ExperienceRecord, ProfessionalProfile } from "@/features/profile/profile-schema";

export const cvPhoneNumber = "+94742729879";

const latexCharacters: Record<string, string> = {
  "\\": "\\textbackslash{}",
  "{": "\\{",
  "}": "\\}",
  "$": "\\$",
  "&": "\\&",
  "#": "\\#",
  "_": "\\_",
  "%": "\\%",
  "~": "\\textasciitilde{}",
  "^": "\\textasciicircum{}"
};

export function escapeLatex(value: string) {
  const normalized = value
    .replace(/\u2013/g, "--")
    .replace(/\u2014/g, "---")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2192/g, "->")
    // Strip emoji-range symbols (real content pulled from LinkedIn descriptions sometimes has
    // these) \u2014 the CV's Latin Modern font can't render them, and they have no place on a formal
    // CV anyway, so dropping them is more correct than letting LaTeX silently omit the glyph.
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "");

  const escaped = normalized.replace(/[\\{}$&#_%~^]/g, (character) => latexCharacters[character]);

  // \texttrademark{}/\textregistered{} are real LaTeX commands, inserted only AFTER the special-
  // character escaping pass above \u2014 inserting them before would have their own backslash/braces
  // re-escaped into literal text (confirmed: this was a real bug, not hypothetical).
  return escaped
    .replace(/\u00a3/g, "\\pounds{}")
    .replace(/\u2122/g, "\\texttrademark{}")
    .replace(/\u00ae/g, "\\textregistered{}");
}

function escapeUrl(value: string) {
  return value.replace(/([#%])/g, "\\$1");
}

function formatMonth(value?: string | null) {
  if (!value) {
    return "Present";
  }
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en", { month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1))
  );
}

function formatPeriod(start?: string, end?: string | null) {
  if (!start) {
    return end ? formatMonth(end) : "";
  }
  return `${formatMonth(start)} -- ${formatMonth(end)}`;
}

export function href(url: string, label: string) {
  return `\\href{${escapeUrl(url)}}{${escapeLatex(label)}}`;
}

function itemize(items: string[]) {
  if (items.length === 0) {
    return "";
  }

  return `\\begin{itemize}\n${items.map((item) => `  \\item ${escapeLatex(item)}`).join("\n")}\n\\end{itemize}`;
}

/**
 * `tailoring`, when provided, only ever reorders or selects among facts already present in
 * `profile` (see lib/application-tailoring.ts's validator) — it never introduces new prose. When
 * omitted, output is identical to the untailored, statically-verified public CV.
 */
export function renderResumeLatex(profile: ProfessionalProfile, github: GitHubSnapshot, tailoring?: SanitizedCvTailoringPlan) {
  const skillGroups = new Map<string, string[]>();
  for (const skill of profile.skills) {
    skillGroups.set(skill.category, [...(skillGroups.get(skill.category) ?? []), skill.name]);
  }
  const skillLabels: Record<string, string> = {
    "genai-ml": "GenAI and ML",
    backend: "Backend",
    frontend: "Frontend",
    data: "Data",
    "cloud-delivery": "Cloud and delivery",
    engineering: "Engineering"
  };

  const skillCategoryOrder = tailoring?.emphasizedSkillCategories ?? [...skillGroups.keys()];

  // Chronologically oldest entries beyond this count are condensed into a single "Earlier Experience"
  // line instead of a full heading each, to keep the CV within its two-page limit regardless of
  // how many positions the profile accumulates. This is always based on chronological age, not
  // tailoring's relevance-based reorder below — an old internship shouldn't earn a full page-one
  // heading just because a job description happens to mention a matching keyword.
  const EARLY_CAREER_ENTRY_LIMIT = 5;
  const chronologicalExperience = [...profile.experience].sort((a, b) => b.startDate.localeCompare(a.startDate));
  const featuredPool = chronologicalExperience.slice(0, EARLY_CAREER_ENTRY_LIMIT);
  const condensedExperience = chronologicalExperience.slice(EARLY_CAREER_ENTRY_LIMIT);

  const orderedExperience: ExperienceRecord[] = tailoring
    ? tailoring.experienceOrder
        .map((id) => featuredPool.find((role) => role.id === id))
        .filter((role): role is ExperienceRecord => role !== undefined)
    : featuredPool;

  const experience = orderedExperience
    .map((role, index) => {
      const selectedHighlights = tailoring?.highlightSelections[role.id];
      const highlights = selectedHighlights ?? (index < 5 ? role.highlights.slice(0, index < 3 ? 4 : 2) : []);
      // A role with neither highlights nor a summary (LinkedIn's Description field left blank
      // for that position) must render as a clean heading-only entry, not a heading followed by
      // an empty \smallskip gap sitting awkwardly next to entries that do have real content.
      const body = highlights.length > 0 ? itemize(highlights) : role.summary ? `\\smallskip\n${escapeLatex(role.summary)}` : "";

      return `\\resumeHeading{${escapeLatex(role.role)}}{${escapeLatex(role.company)}}{${escapeLatex(
        formatPeriod(role.startDate, role.endDate)
      )}}${role.location ? `{${escapeLatex(role.location)}}` : "{}"}\n${body}`;
    })
    .join("\n\n");

  const earlierExperienceSection =
    condensedExperience.length > 0
      ? (() => {
          const items = condensedExperience
            .map((role) => `${escapeLatex(role.company)} | ${escapeLatex(role.role)} | ${escapeLatex(formatPeriod(role.startDate, role.endDate))}`)
            .join("; ");

          return `\\textbf{Earlier Experience}\\\\\n${items}.`;
        })()
      : "";

  const projects = profile.resumeProjects
    ? profile.resumeProjects
        .map((project) => {
          const title = project.links?.length
            ? project.links.map((link) => href(link.url, link.label)).join(" and ")
            : project.url
              ? href(project.url, project.name)
              : escapeLatex(project.name);
          return `\\projectHeading{${title}}{${escapeLatex(project.role)}}\n${escapeLatex(project.description)}`;
        })
        .join("\n\n")
    : github.projects
        .slice(0, 5)
        .map(
          (project) =>
            `\\projectHeading{${href(project.repositoryUrl, project.name)}}{${project.stars.toLocaleString()} stars \\enspace|\\enspace ${escapeLatex(
              project.primaryLanguage ?? "Open source"
            )}}\n${escapeLatex(project.description)}`
        )
        .join("\n\n");

  // Primary/secondary schooling is kept in the profile data for completeness but omitted from
  // the CV itself — standard practice once a candidate has post-secondary qualifications listed.
  const education = profile.education
    .filter((item) => !/high school|secondary school/i.test(item.qualification))
    .map(
      (item) =>
        `\\resumeHeading{${escapeLatex(item.qualification)}}{${escapeLatex(item.institution)}}{${escapeLatex(
          formatPeriod(item.startDate, item.endDate)
        )}}{}`
    )
    .join("\n");

  const certifications = profile.certifications
    .map((certification) =>
      certification.authority
        ? `${escapeLatex(certification.name)} --- ${escapeLatex(certification.authority)}`
        : escapeLatex(certification.name)
    )
    .join(" \\enspace|\\enspace ");

  const languages = profile.languages
    .map((language) =>
      language.proficiency
        ? `${escapeLatex(language.name)} (${escapeLatex(language.proficiency)})`
        : escapeLatex(language.name)
    )
    .join(" \\enspace|\\enspace ");

  const skills = skillCategoryOrder
    .filter((category) => skillGroups.has(category))
    .map(
      (category) =>
        `\\textbf{${skillLabels[category] ?? escapeLatex(category)}}: ${skillGroups.get(category)!.map(escapeLatex).join(", ")}`
    )
    .join("\\\\\n");

  return String.raw`\documentclass[10pt,a4paper]{article}
\usepackage[margin=1.1cm]{geometry}
\usepackage[T1]{fontenc}
\usepackage{lmodern}
\usepackage[utf8]{inputenc}
\usepackage{textcomp}
\usepackage{enumitem}
\usepackage[hidelinks,unicode]{hyperref}
\usepackage{xcolor}
\usepackage{microtype}
\pagestyle{empty}
\setlength{\parindent}{0pt}
\setlength{\parskip}{1pt}
\setlist[itemize]{leftmargin=1.25em,itemsep=0pt,topsep=2pt,parsep=0pt}
\definecolor{accent}{HTML}{7A4B12}
\newcommand{\cvsection}[1]{
  \vspace{4pt}{\large\bfseries\color{accent}#1}\par
  \vspace{1pt}\rule{\linewidth}{0.4pt}\vspace{2pt}
}
\newcommand{\resumeHeading}[4]{
  \textbf{#1} \hfill #3\\
  \textit{#2}\if\relax\detokenize{#4}\relax\else\enspace---\enspace#4\fi\par\vspace{1pt}
}
\newcommand{\projectHeading}[2]{\textbf{#1}\hfill #2\\}
\hypersetup{
  pdftitle={${escapeLatex(profile.identity.name)} - Professional CV},
  pdfauthor={${escapeLatex(profile.identity.name)}},
  pdfsubject={Technical leadership, generative AI, and full-stack engineering}
}
\begin{document}

\begin{center}
  {\LARGE\bfseries ${escapeLatex(profile.identity.name)}}\\[3pt]
  {\large ${escapeLatex(profile.identity.headline)}}\\[4pt]
  ${profile.identity.specialtyLine ? `{\\small ${escapeLatex(profile.identity.specialtyLine)}}\\\\[2pt]` : ""}
  ${escapeLatex(profile.identity.location)}${profile.identity.availability ? ` \\enspace|\\enspace ${escapeLatex(profile.identity.availability)}` : ""}\\
  ${href(`mailto:${profile.identity.email}`, profile.identity.email)}
  \enspace|\enspace ${href(`tel:${cvPhoneNumber}`, profile.identity.phone ?? cvPhoneNumber)}
  \enspace|\enspace ${href(profile.identity.website, "thavarshan.com")}\\
  ${href(profile.identity.linkedin, "linkedin.com/in/thavarshan")}
  \enspace|\enspace ${href(profile.identity.github, "github.com/Thavarshan")}
\end{center}

\cvsection{Professional Summary}
${escapeLatex(profile.summary)}

\cvsection{Core Expertise}
${skills}

\cvsection{Experience}
${experience}

${earlierExperienceSection}

\cvsection{Selected Open-Source Work}
${projects}

\cvsection{Education}
${education}

${profile.certifications.length > 0 ? `\\cvsection{Certifications}\n${certifications}` : ""}

${profile.languages.length > 0 ? `\\cvsection{Languages}\n${languages}` : ""}

\end{document}
`;
}
