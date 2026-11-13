# Free repository security and dependency maintenance

## Repository-managed controls

- `.github/dependabot.yml` checks **npm** and **GitHub Actions** monthly. To keep PRs reviewable, npm patch/minor updates are grouped separately for production and development packages, with at most three npm version-update PRs open. Major versions form a separate group for explicit compatibility review.
- Security fixes are not filtered out by these version-update groups. Dependabot security updates must be **enabled in repository settings**; this YAML file alone does not activate alerts or security updates.
- Dependabot, security updates and human PRs must pass the normal GitHub Actions CI checks before merging. **Never auto-merge** dependency changes and do not bypass the existing protections. Existing `npm audit` and secret scanning in CI stay enabled as defense in depth.
- Actions version updates remain grouped with a separate limit of one open PR.

## Owner-only settings (not controlled by code)

In GitHub, open **Thavarshan/thavarshan.com → Settings → Advanced Security** and enable the free features available to this public repository:

1. **Dependabot alerts** and **Dependabot security updates**.
2. **Secret scanning** and, if offered, **push protection**.
3. Confirm the dependency graph is on and that the security interface shows npm and Actions dependencies. Inspect permissions and GitHub plan/feature eligibility before making changes; do not enable a paid option.

These switches cannot be verified or activated by the version-controlled Dependabot configuration. As of the original 2026-10-11 audit in issue #143, they were **disabled**. A fresh repository API check on **2026-11-14** confirmed Dependabot security updates, secret scanning, and secret-scanning push protection enabled. The vulnerability-alerts endpoint returned HTTP 204, confirming alerts enabled. Only the public repository’s standard free controls were activated; no paid Advanced Security product was enabled. Security alerts may contain sensitive information and belong in GitHub's private security interface, never public issue comments.

## Review procedure

Review monthly Dependabot PR release notes and lockfile diffs, run the full CI (unit tests, security audit, type checking, browser tests, Lighthouse and build), and merge only the tested updates. Review a major version separately for API and runtime compatibility. Dependency PR #173 runs the same required CI gate as ordinary changes. The monthly grouped policy intentionally limits version-update noise; security updates remain independent of that schedule. Review alerts promptly when notified.
