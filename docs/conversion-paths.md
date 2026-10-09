# Hiring and consulting paths

Issues #48/#59 use existing portfolio pages rather than new sales URLs. The homepage's Explore hiring/Explore consulting links reach labelled sections in the shared contact band. Hiring visitors can review career experience, the full CV, downloadable PDF and GitHub profile before Discuss a role. Consulting visitors can review current Fetch PHP/Laravel Filterable project evidence and platform-modernization notes before Discuss a project.

Skill labels come from the validated professional profile; project names/descriptions and links come from the current validated GitHub snapshot. No availability guarantee, pricing, customer count, employer results or revenue claim is introduced. Existing canonical metadata and sitemap URLs remain unchanged; the evidence links improve discovery of existing pages.

Both primary actions open the visitor's email client with a fixed subject and brief template. They do not send an email automatically, store a form submission or call an application API. A generic Start a conversation option and LinkedIn link remain available.

The existing ButtonLink telemetry abstraction maps Hire → `hire_cta` and Consulting → `consulting_cta`. Each email-link click produces one intent event with coarse page location; it does not also emit `contact_cta`. Journey-entry/evidence browsing is not counted as a contact conversion. CV downloads and profile clicks retain their existing events. Attribution, Do Not Track/Global Privacy Control and graceful collector failure remain enforced by the shared client. The mailto subject/body and visitor-entered email content never enter telemetry. Weekly counters already recognize both reserved events, so no Worker redeploy is required.

Counts indicate intent to open an email client, not sent enquiries, unique visitors or visitor conversion rates. See [measurement](measurement.md). Validate with component/event regression tests and the existing browser suite, which intercepts beacons locally and checks mobile/keyboard access. Revert this PR to roll back; no storage migration or paid service is involved.
