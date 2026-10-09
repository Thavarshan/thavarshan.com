# Issue #63 implementation plan

## Discovery

The existing static export has an inventory of route patterns, rendered SEO/link checks and production smoke tests. Pattern normalization intentionally hides individual Insight/project/tool slug changes. `public/_redirects` owns nine exact legacy blog redirects; `netlify.toml` owns the production-host alias. The local static server currently ignores redirects, so its link checks cannot model forced redirects over exported pages.

## Decisions before implementation

- Reuse the existing SEO audit and static server. Add a reviewed concrete page register under `data/` to make additions/removals explicit.
- Keep exact content redirects in `public/_redirects`, with permanent status and final destinations. Preserve existing legacy destinations unless the audit finds a broken target. Host aliases remain separate in `netlify.toml`.
- Add pure parsing/validation for exact path rules, duplicate sources, malformed paths, chains/loops and missing/retired internal targets. Reject unsupported wildcard/conditional/rewrite content rules instead of silently approximating them.
- Add explicit 404 retirement records with reasons; keep unknown routes as genuine 404s. Document when 410 is appropriate, without introducing an unverified hosting feature.
- Extend rendered SEO checks to reject links to known redirect sources (including exported source pages), verify retired pages and redirect behavior. Extend production smoke checks to verify the same deployed rules.
- All work uses current build/CI/Netlify capabilities; no service, dependency, private data or external publisher is added.

## Failure and recovery

Invalid lifecycle/routing data fails CI before merge. A removed URL must retain a permanent redirect to a relevant successor or an explicit 404 retirement decision. Revert the independently scoped commit to restore the last known page register/configuration. External legacy targets are audited manually; CI does not depend on GitHub availability. Production verification uses bounded requests with redirects disabled.
