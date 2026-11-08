# Broad engineering positioning

`marketing/search-positioning.json` maps every current canonical sitemap page to one primary intent, audience, supporting topics, public evidence and CTA. The sitemap coverage test requires a reviewed editorial mapping when pages are added or removed. It compares normalized exact intents; human review still needs to identify semantically similar wording.

## Profile and source ownership

`data/profile.generated.json` is the sanitized professional profile used by the website and CV. It contains the current headline, summary, role history, skills, credentials and selected project descriptions. `data/github.generated.json` is refreshed by `npm run profile:github`; it supplies current public repository descriptions, README excerpts, stars, forks and update dates. Five public repositories are selected by current GitHub adoption, with Dokimos included as additional cross-stack evidence. Private repositories never enter the public profile or project routes.

`Profile.md` is a human-readable GitHub profile copy aligned with the normalized profile. It is not an input to the website build or automated refresh. Keep current repository counts out of it; the site reads them from the GitHub snapshot. `cv/generated/Jerome-Resume.tex` and `public/docs/Jerome-Resume.pdf` are rendered from the validated profile and current repository snapshot by `npm run cv:publish`.

The raw LinkedIn archive is private. `npm run profile:import` updates LinkedIn-owned career and education data from a reviewed archive; it is not run by the weekly content refresh. GitHub refresh updates repository evidence and regenerates the CV, but does not rewrite the profile narrative or `Profile.md`.

## Positioning and evidence

| Audience intent | Public evidence | Content destination |
| --- | --- | --- |
| Technical Lead, Senior Full Stack Engineer, and Generative AI Engineer opportunities | 11+ years of career history; Node.js/TypeScript, React, Java/Spring Boot, Python and PHP/Laravel; GenAI workflows, integrations and reliability work | Homepage and HTML/downloadable CV |
| Product engineering and developer tooling across stacks | Honeymelon, Dokimos, Fetch PHP, Filterable and Matrix, with live GitHub statistics | Projects index and repository detail pages |
| Applied GenAI workflows and semantic/vector search | KAYA workflow engines, chatbot infrastructure, Brompton product search and the production AI workflow Insight | Career timeline, CV and relevant Insights |
| Cloud delivery and production reliability | AWS platform modernization, GCP Cloud Run/NAT work, Kubernetes delivery and CI/CD experience | Career timeline, expertise and CV |
| Laravel/PHP implementation and libraries | Brompton and KAYA experience, Fetch PHP, Filterable, Matrix, and browser-only Laravel tools | Relevant career evidence, project pages and task-specific tools |

Summaries and accomplishments stay grounded in the profile and project sources. Brompton's £130K/month savings and 4.2s-to-1.5s checkout latency are supplied career facts; no conversion attribution is added. Sino Lanka Group bullets describe current involvement and work areas without turning investigations or proposed improvements into completed outcomes. Dokimos explicitly describes AI-likeness as heuristic; no private self-supervised-learning repository is linked.

## Page intent and scope

The homepage and CV present the shared Technical Lead / Full Stack / Generative AI positioning, with the specified stack line and concise supporting evidence. `/projects` combines five repositories selected by current GitHub adoption with Dokimos as additional public Python evidence. Individual project pages retain repository-specific titles, descriptions and structured data. Laravel utilities and PHP project pages remain focused on their actual tasks; they do not define the overall career headline. Existing project URLs are retained or redirected when the repository is renamed.

Insights retain their own technical topics and canonical URLs. Tools keep Laravel/PHP-specific page titles because they solve Laravel/PHP tasks. Privacy remains focused on data collection. The page map is a positioning hypothesis, not a claim about search volumes, rankings or conversion gains.

## Review and future briefs

The primary intent is a user task, not a list of keywords. Multiple pages can share a topic if they answer different tasks. Before creating content, search this map and use `marketing/content-brief-template.md`. Improve an existing page when it already answers the question; add a distinct page only with original evidence/examples. Do not create location, framework or keyword-variation doorway pages. A genuinely replaced URL needs the URL-lifecycle policy and redirect checks.

Review fresh private Search Console/Bing priorities from #66 privately, use comparable observation windows and record limitations. Never copy private query data into a public brief, commit, report or Actions log. `npm run content:review` records evidence-source changes without rewriting profile copy or page content.
