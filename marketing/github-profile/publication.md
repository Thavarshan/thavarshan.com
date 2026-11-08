# Publish Jerome's GitHub profile

Reviewed on 2026-11-08 against the merged repository audit, `Profile.md`, the generated profile snapshot, and the current public CV.

## What is ready

- [README.md](README.md) is the reviewed GitHub profile README. It intentionally includes **no live counters, fake badges, testimonials or automatic contribution graphs**.
- It uses the same name and headline as `data/profile.generated.json`: **Jerome Thayananthajothy — Technical Lead | Full Stack and Generative AI Engineer**.
- It puts PHP/Laravel first, then describes Node/React, Java/Spring Boot, practical Python, cloud, and Generative AI work.
- It links to the portfolio, CV, LinkedIn, and verifiable code. It distinguishes maintained libraries from early-stage Viridian and heuristic Dokimos, and notes Honeymelon's beta interface.
- It states that Jerome is seeking remote roles, open to relocation, and available for focused paid consulting. It makes no change to employment dates or employer claims.

## GitHub settings to apply

The authenticated GitHub CLI account is `Thavarshan` and has repository write access. Its OAuth token does not include the `user` scope, so account-level profile changes must use GitHub's profile settings UI. The social-account API already lists the verified LinkedIn URL; the website and public contact links are already set.

1. Create a **public repository named exactly `Thavarshan` under the `Thavarshan` account**. The old `Thavarshan/Thavarshan` URL currently redirects to `Thavarshan/thavarshan.com` because of an earlier rename; creating the correctly named repository should replace that old redirect. **Do not rename or overwrite `thavarshan.com`.**
2. Add this reviewed README as the new repository's **root `README.md` on its default branch**. Only then will GitHub display it on the profile.
3. Set the GitHub bio to:

   > Technical Lead | Full Stack and Generative AI Engineer · Laravel/PHP, Node.js/TypeScript, React · Open to remote roles, relocation and consulting

4. Keep the public name, website `https://thavarshan.com`, and verified contact links consistent. Leave the location and company fields as they are.
5. Pin **six repositories**: **fetch-php, filterable, phpvm, matrix, honeymelon, viridian**. Viridian is explicitly described as early-stage in the README.
6. Verify while signed out: headline, README, six pins, links to CV, résumé PDF, projects and LinkedIn, and the actual maturity of each featured project.

## Metadata candidates that require repository-settings access

- `matrix`: the About description has been corrected to event-driven ReactPHP helpers; continue checking that it does not claim the old fiber-powered implementation.
- `honeymelon`: prefer the current product name and link; older Comet site references should not imply a separate active product.
- `wallstreet`: description should clearly say **educational / paper trading only**, not passive-profit or autonomous real-money execution.
- `viridian`: About description should signal **planned/early-stage** release and incident intelligence, not a finished agentic service.
- `thavarshan.com`: use the canonical headline and recruiter-focused summary.

## Keep identity claims honest

The public CV currently lists a Sino Lanka Group role with an open-ended date. **Do not independently alter employment dates or announce a new employer.** The profile README stays role-neutral while accurately stating that Jerome is seeking opportunities.

The site's `marketing/external-profile-checklist.md` contains old wording (“selected global technical-leadership conversations”) that underplays immediate availability. The proposed README is intentionally more explicit.

## Measure real progress

Review monthly: maintainer response times, meaningful outside issues/PRs, release quality, package usage, documented compatibility, inbound recruiter messages, interviews, consulting enquiries and project conversion paths. Stars and forks are useful reach signals but do not equal revenue, customers, or quality.

Related work: [portfolio external-authority issue #65](https://github.com/Thavarshan/thavarshan.com/issues/65), [repository maintenance audit](../../docs/plans/repository-maintenance-2026-11.md), and [progress tracker](../../docs/plans/repository-maintenance-progress-2026-11.md). The earlier [profile preparation PR #148](https://github.com/Thavarshan/thavarshan.com/pull/148) was closed unmerged; this revision replaces its dated Laravel-only emphasis and old Comet references.
