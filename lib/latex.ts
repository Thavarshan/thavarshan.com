import type { GitHubSnapshot } from "@/lib/github-model";
import type { ProfessionalProfile } from "@/lib/profile-schema";

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
  return value
    .replace(/\u2013/g, "--")
    .replace(/\u2014/g, "---")
    .replace(/[\\{}$&#_%~^]/g, (character) => latexCharacters[character]);
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

function href(url: string, label: string) {
  return `\\href{${escapeUrl(url)}}{${escapeLatex(label)}}`;
}

function itemize(items: string[]) {
  if (items.length === 0) {
    return "";
  }

  return `\\begin{itemize}\n${items.map((item) => `  \\item ${escapeLatex(item)}`).join("\n")}\n\\end{itemize}`;
}

export function renderResumeLatex(profile: ProfessionalProfile, github: GitHubSnapshot) {
  const skillGroups = new Map<string, string[]>();
  for (const skill of profile.skills) {
    skillGroups.set(skill.category, [...(skillGroups.get(skill.category) ?? []), skill.name]);
  }
  const skillLabels: Record<string, string> = {
    leadership: "Leadership",
    "ai-architecture": "AI \\& Architecture",
    "full-stack": "Full Stack",
    "cloud-delivery": "Cloud \\& Delivery"
  };

  const experience = profile.experience
    .map((role, index) => {
      const highlights = index < 5 ? role.highlights.slice(0, index < 3 ? 4 : 2) : [];
      const body = highlights.length > 0 ? itemize(highlights) : `\\smallskip\n${escapeLatex(role.summary)}`;

      return `\\resumeHeading{${escapeLatex(role.role)}}{${escapeLatex(role.company)}}{${escapeLatex(
        formatPeriod(role.startDate, role.endDate)
      )}}${role.location ? `{${escapeLatex(role.location)}}` : "{}"}\n${body}`;
    })
    .join("\n\n");

  const projects = github.projects
    .slice(0, 5)
    .map(
      (project) =>
        `\\projectHeading{${href(project.repositoryUrl, project.name)}}{${project.stars.toLocaleString()} stars \\enspace|\\enspace ${escapeLatex(
          project.primaryLanguage ?? "Open source"
        )}}\n${escapeLatex(project.description)}`
    )
    .join("\n\n");

  const education = profile.education
    .map(
      (item) =>
        `\\resumeHeading{${escapeLatex(item.qualification)}}{${escapeLatex(item.institution)}}{${escapeLatex(
          formatPeriod(item.startDate, item.endDate)
        )}}{}`
    )
    .join("\n");

  const professionalProjects = profile.professionalProjects
    .map((project) => {
      const title = project.url ? href(project.url, project.name) : escapeLatex(project.name);
      return `\\projectHeading{${title}}{${escapeLatex(project.role)}}\n${escapeLatex(project.description)}\n${itemize(
        project.highlights.slice(0, 2)
      )}`;
    })
    .join("\n\n");

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

  const skills = [...skillGroups.entries()]
    .map(
      ([category, items]) =>
        `\\textbf{${skillLabels[category] ?? escapeLatex(category)}}: ${items.map(escapeLatex).join(", ")}`
    )
    .join("\\\\\n");

  return String.raw`\documentclass[10pt,a4paper]{article}
\usepackage[margin=1.35cm]{geometry}
\usepackage[T1]{fontenc}
\usepackage{lmodern}
\usepackage[utf8]{inputenc}
\usepackage{enumitem}
\usepackage[hidelinks,unicode]{hyperref}
\usepackage{xcolor}
\usepackage{microtype}
\pagestyle{empty}
\setlength{\parindent}{0pt}
\setlength{\parskip}{2pt}
\setlist[itemize]{leftmargin=1.25em,itemsep=0pt,topsep=2pt,parsep=0pt}
\definecolor{accent}{HTML}{7A4B12}
\newcommand{\cvsection}[1]{
  \vspace{6pt}{\large\bfseries\color{accent}#1}\par
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
  pdfsubject={Technical leadership, AI systems architecture, and full-stack engineering}
}
\begin{document}

\begin{center}
  {\LARGE\bfseries ${escapeLatex(profile.identity.name)}}\\[3pt]
  {\large ${escapeLatex(profile.identity.headline)}}\\[4pt]
  ${escapeLatex(profile.identity.location)}
  \enspace|\enspace ${href(`mailto:${profile.identity.email}`, profile.identity.email)}
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

\newpage
\cvsection{Selected Open-Source Work}
${projects}

${profile.professionalProjects.length > 0 ? `\\cvsection{Product Work}\n${professionalProjects}` : ""}

\cvsection{Education}
${education}

${profile.certifications.length > 0 ? `\\cvsection{Certifications}\n${certifications}` : ""}

${profile.languages.length > 0 ? `\\cvsection{Languages}\n${languages}` : ""}

\end{document}
`;
}
