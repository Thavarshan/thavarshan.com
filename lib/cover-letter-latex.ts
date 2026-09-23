import type { ProfessionalProfile } from "./profile-schema";
import { escapeLatex, href } from "./latex";

export interface CoverLetterJobMeta {
  title: string;
  company: string | null;
}

function paragraphs(body: string) {
  return body
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => escapeLatex(paragraph))
    .join("\n\n\\vspace{6pt}\n\n");
}

/**
 * Renders a validated, AI-drafted cover letter body into a simple business-letter LaTeX document.
 * `body` is expected to have already been through the hallucination-check scan upstream — this
 * function only formats it, it does not re-validate content.
 */
export function renderCoverLetterLatex(profile: ProfessionalProfile, job: CoverLetterJobMeta, body: string, now: Date) {
  const recipient = job.company ? `${escapeLatex(job.company)} Hiring Team` : "Hiring Team";
  const salutation = job.company ? `Dear ${escapeLatex(job.company)} Hiring Team,` : "Dear Hiring Team,";
  const date = new Intl.DateTimeFormat("en", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }).format(now);

  return String.raw`\documentclass[11pt,a4paper]{article}
\usepackage[margin=2.5cm]{geometry}
\usepackage[T1]{fontenc}
\usepackage{lmodern}
\usepackage[utf8]{inputenc}
\usepackage[hidelinks,unicode]{hyperref}
\usepackage{microtype}
\pagestyle{empty}
\setlength{\parindent}{0pt}
\setlength{\parskip}{0pt}
\hypersetup{
  pdftitle={${escapeLatex(profile.identity.name)} - Cover Letter for ${escapeLatex(job.title)}},
  pdfauthor={${escapeLatex(profile.identity.name)}}
}
\begin{document}

{\bfseries ${escapeLatex(profile.identity.name)}}\\
${escapeLatex(profile.identity.location)}
\enspace|\enspace ${href(`mailto:${profile.identity.email}`, profile.identity.email)}
\enspace|\enspace ${href(profile.identity.website, "thavarshan.com")}

\vspace{18pt}
${date}

\vspace{12pt}
${escapeLatex(recipient)}
Re: ${escapeLatex(job.title)}

\vspace{18pt}
${salutation}

\vspace{6pt}
${paragraphs(body)}

\vspace{18pt}
Sincerely,\\
${escapeLatex(profile.identity.name)}

\end{document}
`;
}
