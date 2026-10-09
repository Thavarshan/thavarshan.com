# Hiring and consulting journeys — #48 and #59

## Discovery and scope

The homepage, CV and project/Insight pages already expose profile evidence and generic contact links. The existing cookie-free event contract reserves `hire_cta` and `consulting_cta`, but neither is wired to a CTA. #59 describes the same visitor journeys as #48; one focused implementation can satisfy both without new sales pages or URLs.

## Plan

- Keep the generated professional profile and GitHub snapshot as evidence sources. Surface supported PHP/Laravel/cloud skills and current maintained projects, linking to existing CV, career, project and Insight pages.
- Reuse ContactBand for two clear paths: hiring (experience → CV/GitHub → role enquiry) and consulting (project/architecture evidence → project enquiry). Homepage entry links jump to these sections; retain a generic contact option.
- Compose fixed, useful mailto subjects/brief prompts. Visitors send their own email; no form backend, private submission storage or sending automation is added.
- Extend the existing CTA vocabulary to the two reserved intent events. Count email-link clicks only, with existing coarse page location, attribution and privacy opt-out behavior. Browsing a journey is not a contact conversion.
- Cover evidence availability, metadata-independent anchors, keyboard/mobile access and exact single-event tracking. Existing SEO/browser/Lighthouse gates protect static export, crawlability and performance.

## Validation, constraints and recovery

No dependencies, new routes, paid services or unsupported customer/outcome claims. Tests cover actual links and event wiring, not copy snapshots. Run typecheck/lint/format/test/build, existing CI and exact preview/production deployment checks. Browser tests intercept telemetry locally; no synthetic analytics events are sent to production. Docker is unavailable here; pinned Docker CV checks run in CI. Revert this PR to restore the previous contact UI; no migration is required.
