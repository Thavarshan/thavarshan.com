# Repository maintenance progress — November 2026

**Updated: 2026-11-08.** This tracker executes the recommendations in the [repository maintenance audit](repository-maintenance-2026-11.md). The audit is a 2026-11-06 snapshot; this file records live checks and changes after that snapshot. Keep private repository names and details out of this public tracker.

## Baseline verified

- `gh auth status` identifies the authenticated account as **Thavarshan** with public and private repository access. Repository administration is available for `Thavarshan/thavarshan.com`.
- `gh repo list Thavarshan --limit 1000` returned all **63 owned repositories**: **56 public** (45 active, 11 archived) and **7 private**. One public repository is a fork. Counts match the audit.
- The live public profile still has the generic bio “I code...? 🤷‍♂️”. Its name, website (`https://thavarshan.com`), and LinkedIn social link are already correct. Six repositories are pinned; Wisp is one of them.
- The old `/Thavarshan/Thavarshan` repository URL resolves to `thavarshan.com`. Creating the special profile repository will replace that redirect; keep `thavarshan.com` under its existing name.
- Merged work remains merged: `thavarshan.com` #155, `matrix` #18, and `github-templates` #1. Do not recreate those changes.
- Known issues remain open: [Filterable #57](https://github.com/Thavarshan/filterable/issues/57), [Wisp #2](https://github.com/Thavarshan/wisp/issues/2), and [Composer Upgrade Helper #2](https://github.com/Thavarshan/composer-upgrade-helper/issues/2).

## Profile work

- [x] Read merged PR #155, its repository audit, the profile draft, `Profile.md`, generated profile data, and the current public CV.
- [x] Confirm the public CV supports the role headline, 11+ years, three years of technical leadership, and the selected engineering examples. Do not alter employment dates.
- [x] Refine the profile README: put Laravel/PHP first, include the requested cross-stack and AI evidence, clarify project maturity, and use the public CV contact address.
- [ ] Create public `Thavarshan/Thavarshan` without renaming or replacing `thavarshan.com`; publish the reviewed README at its root.
- [ ] Replace the generic bio and keep the verified website/LinkedIn details.
- [ ] Update the six pins to Fetch PHP, Filterable, phpvm, Matrix, Honeymelon, and early-stage Viridian.
- [ ] Verify the rendered profile and links while signed out.

## Repository waves

| Repository | Current state | Next action |
| --- | --- | --- |
| [fetch-php](https://github.com/Thavarshan/fetch-php) | Baseline started. Open Dependabot PRs #184 (GitHub Actions) and #185 (PHP_CodeSniffer compatibility) are mergeable; check results and diffs still need review. | Inspect workflow results, dependency diffs, release history, README, and tests before merging or editing. |
| [filterable](https://github.com/Thavarshan/filterable) | PR #56 adds contributor guidance, but CI fails in Laravel 11 and `lowest` dependency jobs before package tests because Composer blocks currently advised versions. Other listed matrix jobs pass. Issue #57 owns the security-policy investigation. | Do not merge #56 or bypass Composer security policy. Identify secure compatible Laravel 11 baselines and make README support policy match tested support. |
| [phpvm](https://github.com/Thavarshan/phpvm) | Not yet inspected in this wave. | Check repository instructions, install commands, OS/shell coverage, and tests. |
| [matrix](https://github.com/Thavarshan/matrix) | PR #18 is already merged. | Verify loop ownership, cancellation, timeout, retry behavior, and contributor path; no duplicate docs PR. |
| [honeymelon](https://github.com/Thavarshan/honeymelon) | Existing open PR #143 reduces Dependabot notification noise; multiple older dependency PRs are also open. | Read `AGENTS.md`, current stable/beta support, installer guidance, PR checks, and dependency compatibility before proposing changes. |
| [thavarshan.com](https://github.com/Thavarshan/thavarshan.com) | Local checkout was clean and 25 commits behind. Fast-forwarded to `origin/main`; no local changes were overwritten. Profile README and this tracker are being prepared on `docs/github-profile-and-portfolio-tracker`. | Validate this documentation change, open a focused PR, and merge only after required checks pass. |

## Existing pull requests to preserve

- [Filterable #56](https://github.com/Thavarshan/filterable/pull/56), [Wisp #1](https://github.com/Thavarshan/wisp/pull/1), and [Composer Upgrade Helper #1](https://github.com/Thavarshan/composer-upgrade-helper/pull/1) are already open documentation PRs. Review or improve those branches; do not duplicate them.
- Fetch PHP #184 and #185 already cover active dependency updates. Use their branches for those changes rather than opening competing updates.
- Wisp issue #2 reports 13 advisories across 7 packages. Composer Upgrade Helper issue #2 covers stale tests and unsafe Composer constraint handling. Both need implementation in focused follow-up PRs after their existing docs PRs are reviewed.

## Monetization signal

The lowest-cost near-term offer remains paid Laravel/PHP, Node.js, and practical AI engineering or integration work, supported by public code and the portfolio. Validate it through direct conversations and the existing contact path. Do not add hosting costs or speculative paid features before a customer asks for them.

## Next checkpoint

Complete the profile publication and the first four repository reviews (Fetch PHP, Filterable, phpvm, Matrix), record exact checks and test results here, then report findings before proceeding through Honeymelon and the portfolio.
