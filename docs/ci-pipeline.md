# Website CI and deployment verification

Tracks [issue #105](https://github.com/Thavarshan/thavarshan.com/issues/105).

## Plan and implementation

1. Keep the existing quality, browser, rendered SEO, reproducible CV and Lighthouse checks. Add a read-only security job and one stable `ci-gate` check that rejects failed, missing, skipped or cancelled mandatory jobs.
2. Pin every external action to a full commit SHA. Dependabot proposes weekly grouped action updates. Install actionlint and Gitleaks from fixed official releases, checking SHA-256 before execution. Validate workflows, enforce immutable action references, prove secret detection/redaction with an ephemeral fixture, and scan the current tracked tree plus all commits since the adoption baseline (`c088933cd726e709c4b10b18cbf0a59dac2d969f`). This also detects secrets introduced and removed in later commits. The first full-history scan flagged 46 older generic-key matches, mainly legacy Vue/build bundles and synthetic test credentials. Earlier history needs a separate credential audit; this PR neither certifies it clean nor adds blanket allowlists. The existing synthetic environment-check fixture is assembled at runtime to preserve its assertions without resembling a committed credential. No unredacted token or scanner artifact is published. Review checksum/version updates against upstream release assets.
3. Upload the quality job's static export once and use that same run's artifact for SEO and Lighthouse. Browser tests intentionally build separately: their public telemetry variables differ. Do not share artifacts between different runs or environments. All CI jobs have explicit timeouts; only superseded PR CI runs are cancelled, leaving main checks to finish.
4. Preserve failed Playwright traces, screenshots and HTML reports and Lighthouse reports for one day. Traces can contain fixture/network data; keep test credentials synthetic and inspect before sharing downloaded reports.
5. Emit `build-info.json` after each successful static export, with the full revision and deployment context. Production checks must see the expected production revision before testing anything else. Branch/deploy-preview exports receive `X-Robots-Tag: noindex, nofollow`; the marker itself is never indexed or cached.
6. Convert scheduled generated-content writes to explicitly CI-validated PRs so required checks do not break automation.
7. Check actual HTTP responses and the deployed PDF after successful main-push CI, every six hours and on demand. The production check waits at most 20 marker requests (10-second request deadlines and 19 fifteen-second gaps), with a 12-minute job ceiling. It verifies core routes, canonical URLs, indexing, security headers, the trailing-slash and alias permanent redirects, real 404s and extracted CV text including the phone. JSON failures identify URL and rule. It reports failure; it never deploys, rolls back or changes production.

## Triggers and trusted code

`Deployment Smoke` uses `workflow_run` only for successful CI **pushes/manual CI on main, same-repository pull requests, or explicitly dispatched generated-content PRs**. It always checks out trusted main with read-only permissions, uses no production secrets, and consumes no artifacts from the triggering workflow. It checks the current main revision, so a delayed older CI completion does not incorrectly demand an old deployment. Scheduled checks also detect drift or unavailable deployments between merges.

Production deploys are part of CI, after the existing mandatory `ci-gate`. The deploy job rebuilds with production-only build values, uses the existing Cloudflare credentials, deploys the static site and www redirect, then verifies the exact commit via `build-info.json`. A failed deploy or smoke check fails the run. The scheduled Deployment Smoke workflow also monitors production.

Same-repository PRs retain automatic static previews after successful CI. The trusted default-branch Deployment Smoke workflow checks the PR repository before using credentials, downloads only the triggering run's static artifact, validates its revision/context marker, and deploys it under `thavarshan-site-pr-<number>.tjthavarshan.workers.dev`. It never executes PR code or installs PR dependencies with the deployment token. Fork previews are excluded. Preview exports have noindex headers and production canonical URLs. Manual smoke checks accept only the named site's HTTPS Workers preview origins and a full deployed revision. See [deployment setup](cloudflare-deployment.md).

## Required CI on main

The `Required website CI` repository ruleset requires `ci-gate` from GitHub Actions (integration 15368) on `main`, with an always-available bypass for repository administrators, as requested for this personal project. Keep the separate deletion-protection ruleset. `.github/rulesets/required-ci.json` is the importable configuration. Status checks are not required to be up to date with the base branch, so unrelated main commits do not invalidate existing PR checks; job publication independently rejects any main change while its checked snapshot is being prepared.

Profile, OSS and growth content updates open PRs and explicitly dispatch CI because default-token PR events suppress normal PR CI. The Actions setting allowing PR creation must remain enabled. Job updates instead push a temporary `automation/checked-jobs-*` branch, wait for successful full CI and `ci-gate` on the exact revision plus its corresponding commit status, then fast-forward `main` to that same revision. No token, deploy key or admin bypass is needed. CI failure or stale main leaves main unchanged. Publication dispatches main CI again so the existing production smoke workflow runs after deployment.

Production smoke is post-deployment and is not a pre-merge requirement. Require `ci-gate`; use deployment smoke failures for release follow-up.

## Validation and rollback

Unit fixtures cover stale/wrong markers, unsafe URLs, security headers, indexing, PDF headers, canonical mismatches, immutable-action drift and unsuccessful/missing gate results. Existing CV tests check extractable text and phone content; deployment smoke invokes the same verifier on the downloaded PDF. The security script checks a synthetic secret cannot pass or appear unredacted in logs/reports. Run `npm run typecheck`, `npm run format:check`, `npm run lint`, `npm test`, `bash automation/ci/security.sh`, `npm run build` and all GitHub CI jobs. Validate real production/preview smoke after deploying this PR; fixtures do not certify the hosted deployment.

Revert the PR to restore prior workflows. The owner can disable the additional CI ruleset independently; leave deletion protection in place. Production diagnostics never mutate deployments. Automatic preview publication is the isolated exception described above.


## Dispatched CI and required checks

[GitHub documents](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks#checks-from-some-workflow-jobs-are-not-evaluated) that `workflow_dispatch` job checks are not evaluated as required branch checks. Therefore the `ci-gate` job uses the commit-status API for dispatched runs only. It posts `ci-gate=success` only when the gate step and every mandatory dependency succeeded; otherwise it posts failure. The status targets the exact GITHUB_SHA and links to its run. API/authentication failure fails the gate, and the job publisher requires that recorded status in addition to the successful workflow. All other CI jobs retain read-only permissions; only the gate receives `statuses: write`. The repository ruleset and its expected GitHub Actions integration remain unchanged.
