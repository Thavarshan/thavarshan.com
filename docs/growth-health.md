# Weekly Growth Engine health

`Growth Engine Health` runs every Monday at 05:45 UTC (11:15 Sri Lanka), after the existing collectors, and supports manual Actions dispatch. Changes to its code/workflow on main trigger an initial verification run. Its job summary is the durable operational view; `growth-health-report` contains `report.json` and `summary.md` with the repository's one-day artifact retention.

Run locally with `npm run growth:health`, or `npm run growth:health -- --offline` to validate existing snapshots without network access. The default writes only ignored `test-results/growth-health/` output. An optional `GITHUB_TOKEN` grants access to this public repository's run metadata. Never supply private application credentials. `--write-baseline` additionally prepares a validated comparison file; Actions proposes it through a separate generated-data PR rather than writing main directly.

## Interpretation

- Status is `attention` for errors, `watch` for warnings, otherwise `healthy`. A green report workflow means the report was produced; it does not imply every subsystem is healthy. Findings include a severity and maintenance action.
- Nine known workflows are inspected using at most 20 main runs each. Latest attempted state and last successful run are separate. Skipped runs are excluded. Missing/blocked/malformed history is unknown, and last success is only the latest found within this bounded window. Event-driven workflows have no schedule deadline.
- Jobs and individual sources become stale after 36 hours; profile and analytics after 216 hours; marketing GitHub/registry inputs after 336 hours. Active opportunities not observed for 168 hours are excluded from high-fit results. Future timestamps beyond five minutes are invalid.
- Eligible jobs must agree with the current deterministic scorer. High-fit requires an eligible active job with stored and recomputed scores at least 70 and a recent observation. Source failures, retained empty-source records, collector version differences and scoring drift produce findings. Unknown eligibility is counted separately.
- The marketing ledger supplies recorded generated-bundle count and latest generation date. No new bundle can be legitimate when there is no qualifying milestone; a quiet ledger alone is not a failure. The GitHub and package-registry inputs have independent freshness checks.
- Analytics reports the existing aggregate period, action counts and coverage. No events can legitimately mean zero, while unavailable inputs mean unknown. Days without counters cannot distinguish quiet traffic from collection gaps. Events are not visitors, enquiries or a conversion rate.
- Application generation is `ran`, `skipped` or `unknown`, based only on the named generation step. Prepared/applied counts remain unavailable: private state is never read, and a green workflow proves no submission. Scheduled generation may be skipped until its private destination is configured; manual free preparation remains available.
- Production checks only its public build metadata; a revision difference during publication is a warning. The metrics Worker's public GET health endpoint is checked without sending synthetic analytics events. Access-protected job-review health is deliberately not collected. Authenticated search ownership, indexing and performance remain unknown/unavailable.

## Comparable opportunities

`data/growth-health/baseline.json` stores only schema version, timestamp and opaque IDs already present in the public job snapshot. The report separately lists newly eligible/high-fit IDs (including previously known jobs that became eligible) and newly discovered high-fit IDs. Look up reported IDs in the public snapshot and review current job availability before applying.

The initial baseline has unknown deltas. Fresh, complete collection with consistent scoring can propose the next baseline using the existing generated-PR helper. Malformed/future baselines and stale/partial/inconsistent job data preserve the last accepted state. Every baseline PR must pass `ci-gate` and be reviewed before merge. A pending baseline PR blocks another proposal; comparisons remain against the last accepted timestamp, so the displayed interval can exceed one week. After 216 hours that interval produces a maintenance warning. This committed baseline avoids relying on expired weekly artifacts.

## Privacy, cost and recovery

The reader allows only this repository's workflow/job metadata, production build information and public metrics health. Requests use fixed destinations, no redirects, ten-second timeouts and a 2 MiB response limit. Tokens are sent only to GitHub. Responses are schema-validated and projected to safe fields; external descriptions, source errors and arbitrary notes never enter summaries. No private repository, application artifact, log, mailbox or notification integration is accessed.

The report job has read permissions; a separate publication job has the existing generated-PR permissions. At most twelve metadata/health requests are made per execution. Existing public Actions/free services are reused without paid APIs or new dependencies. Subsystem failures still produce a report. A failure to write the report fails the job rather than claiming health. Revert the feature PR to remove the workflow, or restore a previously accepted baseline if comparison state is damaged; do not manufacture zero counts to repair missing data.
