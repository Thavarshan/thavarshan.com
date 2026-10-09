# Weekly Growth Engine report — #50

## Discovery

Existing workflows cover profile/CV, jobs, marketing bundles, aggregate metrics, private application preparation and optional Worker deployments. Public snapshots have typed contracts; no health report exists. Artifact retention is one day, so weekly comparisons cannot rely on the previous week's artifact. Private job-review health requires Access; application state must not be read from or published to this repository.

## Plan

- Use deterministic typed report rules with explicit freshness thresholds and severity. Read existing snapshots, generated marketing ledger, public GitHub Actions metadata and public site/metrics health only.
- Summarize the latest main run and last successful run for each known workflow. Distinguish failed/cancelled, running, stale, missing and unknown collection; event-driven deploys have no arbitrary schedule deadline.
- Validate jobs before reporting eligible/high-fit counts, source health, version/scoring anomalies and changes from the last accepted public baseline. Initial or unavailable baseline means unknown deltas, not all jobs labelled new.
- Reuse aggregate growth snapshot data with dates and coverage limits. Private application counts and Access-protected Worker health stay unavailable; workflow generation-step metadata may reveal scheduled preparation was skipped, but successful execution does not prove submission.
- Produce a safe Markdown summary and schema-versioned JSON artifact even when a subsystem fails. Publish only a validated public comparison baseline through the existing generated-PR helper; an unavailable/malformed input preserves the last accepted baseline. A pending baseline PR means the comparison period remains older and is shown explicitly.
- Add Monday schedule, manual dispatch and a main-only push trigger for initial operational verification. Bound API queries/timeouts and use the existing shared generated-content concurrency policy. Never post notifications or read private repositories, workflow logs, artifacts containing applications, mailbox data or credentials.

## Validation, cost and recovery

Exercise empty/stale/future dates, failed/running workflows, skipped applications, zero/unknown job eligibility, initial/delta baselines, partial/malformed snapshots and privacy fixtures. Run code quality/tests/build and CI. Verify the actual post-merge report workflow and its artifact; technical site verification uses existing production smoke. Public GitHub Actions and existing services remain $0. Roll back by reverting this PR; retain/restore the last validated comparison baseline. No new runtime service or paid dependency is added.
