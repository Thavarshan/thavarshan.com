# Publish Jerome's GitHub profile

Prepared on 2026-11-06 from current repository metadata and the portfolio's canonical profile snapshot.

## What is ready

- [README.md](README.md) is the proposed GitHub profile README. It intentionally includes **no live counters, fake badges, testimonials or automatic contribution graphs**.
- It uses the same name and headline as `data/profile.generated.json`: **Jerome Thayananthajothy — Technical Lead | Full Stack and Generative AI Engineer**.
- It links to the portfolio, CV, LinkedIn and verifiable code. It distinguishes maintained libraries from early-stage Viridian and heuristic Dokimos.
- It advertises availability without claiming a current employer or promising consulting availability on fixed terms.

## GitHub settings to apply

The GitHub connector can edit repository content but **cannot create repositories or change account fields, pins or repository About metadata**. These remain owner-operated steps:

1. Create a **public repository named exactly `Thavarshan` under the `Thavarshan` account**. The old `Thavarshan/Thavarshan` URL currently redirects to `Thavarshan/thavarshan.com` because of an earlier rename; creating the correctly named repository should replace that old redirect. **Do not rename or overwrite `thavarshan.com`.**
2. Copy [README.md](README.md) to the new repository's **root `README.md` on its default branch**. Only then will GitHub display it on the profile.
3. Suggested GitHub bio (within 160 characters):

   > Technical Lead · Full Stack & Generative AI Engineer. Building developer tools, reliable platforms and practical AI. Open to remote roles.

4. Keep the public name, website `https://thavarshan.com`, and verified contact links consistent. Confirm the location and company field against your current real circumstances before changing either.
5. Pin repositories for a balanced story, **six pins**: **fetch-php, filterable, phpvm, honeymelon, matrix, thavarshan.com**. If hiring for Python/AI specifically, swap one pin for **dokimos**, not for the early-stage Viridian.
6. Verify while signed out: headline, README, six pins, links to CV, résumé PDF, projects and LinkedIn, and the actual maturity of each featured project.

## Metadata candidates that require repository-settings access

- `matrix`: the About description has been corrected to event-driven ReactPHP helpers; continue checking that it does not claim the old fiber-powered implementation.
- `honeymelon`: prefer the current product name and link; older Comet site references should not imply a separate active product.
- `wallstreet`: description should clearly say **educational / paper trading only**, not passive-profit or autonomous real-money execution.
- `viridian`: About description should signal **planned/early-stage** release and incident intelligence, not a finished agentic service.
- `thavarshan.com`: use the canonical headline and recruiter-focused summary.

## Keep identity claims honest

The website snapshot currently lists a Sino Lanka Group role with an open-ended date. Jerome has separately discussed a change in employment status. **Do not independently alter employment dates or announce a new employer**. Confirm the preferred public wording and update the canonical LinkedIn-derived source, site, CV and GitHub together; GitHub profile text can remain role-neutral meanwhile.

The site's `marketing/external-profile-checklist.md` contains old wording (“selected global technical-leadership conversations”) that underplays immediate availability. The proposed README is intentionally more explicit.

## Measure real progress

Review monthly: maintainer response times, meaningful outside issues/PRs, release quality, package usage, documented compatibility, inbound recruiter messages, interviews, consulting enquiries and project conversion paths. Stars and forks are useful reach signals but do not equal revenue, customers, or quality.

Related work: [portfolio external-authority issue #65](https://github.com/Thavarshan/thavarshan.com/issues/65). The earlier [profile preparation PR #148](https://github.com/Thavarshan/thavarshan.com/pull/148) was closed unmerged; this revision replaces its dated Laravel-only emphasis and old Comet references.
