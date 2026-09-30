# OSS distribution bundles

Turns **verified** repository and package-registry changes into **reviewable** promotion drafts (issue #46). It extends the existing marketing primitives (`insights:bundle` covers articles; this covers open-source project activity). It never posts anything, uses no AI, no paid service and no secrets, and runs entirely from the snapshots already committed to the repository.

```bash
npm run marketing:oss -- --dry-run           # explain the decisions and print any drafts, write nothing
npm run marketing:oss                        # write drafts to marketing/oss/ and update the ledger
npm run marketing:oss -- --dry-run --backfill  # preview what the current best milestone/release would look like
```

## How it decides

Inputs: `data/github.generated.json` (stars) and `data/package-registry.generated.json` (installs, dependents, latest released version and its date). Both are refreshed by the Content Refresh workflow; this workflow runs after it completes, and can be started manually.

An event qualifies only if it is a **meaningful change**:

| Event | Qualifies when |
| --- | --- |
| Release | a new **stable minor or major** version (x.y.0 or x.0.0). Patch releases, pre-releases, unrecognised versions and downgrades are recorded and skipped, with the reason. |
| Stars | a newly crossed milestone: 25, 50, 100, 250, 500, 1k, 2.5k, 5k, 10k |
| Installs | 1k, 5k, 10k, 25k, 50k, 100k, 250k, 500k, 1M |
| Dependents | 5, 10, 25, 50, 100, 250, 500 |

If several milestones are crossed at once, only the highest is announced.

**Duplicate and spam control**
- A committed **ledger** (`marketing/oss-ledger.json`) records every event ever decided, so the same event is never drafted twice.
- The first run records a **baseline** (everything already true) and announces nothing, so turning this on cannot flood you with stale drafts.
- At most **3 bundles per run**, **one per project per run**, and a **14-day cooldown** per project. Events held back by these limits are not dropped; they are re-evaluated next run.
- Snapshots older than 14 days stop drafting entirely (claims could be out of date).

## What you get

For each qualifying event, `marketing/oss/<event>/` contains:

- `summary.md` — why it qualified, the facts you may state, an **evidence table** (value, source file, JSON path, date observed), links, and a review checklist
- `linkedin.md`, `devto-outline.md`, `community.md` (releases only: disclosure, usefulness-first, posting etiquette — a bare milestone number is not news to a community, so none is drafted), `changelog.md`
- `metadata.json` — event id, evidence, canonical URL, UTM-tagged links per channel (`linkedin`, `devto`, `reddit`, `github`), generator version, `needsHumanInput`, `autoPosted: false`

## Guardrails

- **Never invents numbers.** Drafts are deterministic templates filled only from recorded evidence. Before anything is written, `findUnverifiedNumbers` scans every draft; a number with no evidence aborts the run with nothing written. Tests cover randomised events and deliberately invented claims ("used by 12,000 developers", "2x faster", revenue).
- **Release notes are not in the data, so the drafts do not pretend to know them.** Wherever a human must add substance, the draft has a `[WRITE: …]` marker; the bundle reports how many remain (`needsHumanInput`).
- **No auto-posting, anywhere.** Nothing calls LinkedIn, DEV or Reddit; a test asserts the workflow contains no secrets and no network-posting commands.
- **External text is treated as untrusted:** project descriptions are flattened, stripped of control characters and length-limited; repository names are validated before they become paths or URLs.
- **Failure safety:** all bundles are built and verified before any file is written; the ledger is written last; an unreadable ledger stops the run (it does not reset to "first run").

## Observability

Each run's job summary says why content was or was not generated: one row per decision (drafted, skipped with the reason, held with the reason, superseded), the baseline count, and a "where things stand" list (for example "Fetch PHP: 451 stars; next milestone 500 (49 to go)").

## Reviewing and publishing

1. Open the bundle's `summary.md`; check the evidence table.
2. Fill or delete every `[WRITE: …]` marker; read the real release notes.
3. Post by hand, to one community at a time, following that community's rules.

## Cost

$0. Reads committed files, runs on GitHub Actions free minutes (public repository), no secrets. See `docs/cost-policy.md`.

## Known limitations

- Releases are detected from the registry's `latestVersion`; release **notes** and changelogs are not available offline.
- The registry sync currently reports a pre-release (for example `4.0.0-beta.1`) as "latest" when it is the newest tag. The detector ignores pre-releases, so nothing wrong is announced, but the stable release will not be seen until it becomes the newest version.
- Milestones are checked when snapshots refresh (weekly), so a milestone may be announced a few days after it happens.
