# Laravel/PHP search positioning

`marketing/search-positioning.json` maps every current canonical sitemap page to one primary intent, audience, supporting topics, public evidence and CTA. The sitemap coverage test requires an editorial mapping when pages are added or removed. It compares normalized exact intents; human review still needs to identify semantically similar wording.

## Evidence and topic boundaries

| Topic | Public evidence | Destination strategy |
| --- | --- | --- |
| Laravel/PHP engineering | Profile skills include Laravel/PHP/Eloquent; Brompton experience describes Laravel + Vue on AWS | Homepage evaluates fit; CV supplies career evidence; Filterable demonstrates a specific library |
| React/Vue/Inertia | Profile skills and experience | Supporting full-stack capability on home/CV; no separate thin framework landing pages |
| API architecture | Fetch PHP and Matrix descriptions; API-design and async-PHP Insights | Project pages evaluate software; Insights explain decisions and trade-offs |
| Developer tooling | PHPVM, Comet and browser-only tools | Projects describe repositories; tools solve their named task |
| Modernization and leadership | Profile roles; modernization Insight | Career evidence on CV; first-hand operating lessons in the Insight |
| AWS/cloud and AI | Profile skills/experience; reliable-AI-workflows Insight | Supporting hiring context; article-specific workflow reliability intent |

Skills and owner-authored content support relevance, not independently verified commercial outcomes. Do not add claims about availability, relocation, certifications, proficiency levels, client permission or measured savings without reviewing their source. This change introduces no new numerical accomplishments.

## Page audit and changes

Home keeps the visible name H1 and its existing Laravel/PHP eyebrow. Its title and description now mention Laravel/PHP and technical leadership, with React/Vue/Inertia, AWS and AI supporting context. CV retains its distinct “Professional CV” title and name H1; its description now names the documented stack. This keeps hiring evaluation separate from CV evidence.

Projects keeps its open-source collection title and developer-tool heading; each detail page retains its repository-specific title, description and name H1. Insights keeps the engineering collection title; each article owns its existing question/lesson, rather than a generic “Laravel developer” intent. Tools and each tool already have task-specific Laravel/PHP titles, H1s and descriptions; preserve these. Privacy serves a policy intent, not a hiring keyword. Existing navigation and related links are already descriptive and canonical; no keyword-heavy anchor rewrite is needed.

## Cannibalization and future briefs

The primary intent is a user task, not a list of keywords. Multiple pages can share a topic if they answer different tasks. Before creating content, search this map and use `marketing/content-brief-template.md`. Improve an existing page when it already answers the question; add a distinct page only with original evidence/examples. Do not create location, framework or keyword-variation doorway pages. A genuinely replaced URL needs the existing URL-lifecycle policy and redirect checks.

The map is an evidence-based positioning hypothesis. No search volumes, ranking changes or conversions are inferred from passing CI. Review fresh private Search Console/Bing priorities from #66 privately, use comparable observation windows and record limitations. Never copy private query data into a public brief, commit, report or Actions log. The content cadence in #61 will operationalize this review.
