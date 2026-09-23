# AI-tailored application packages

This is Phase 2 of the job-discovery platform described in the wider spec (see `docs/jobs-data.md` for the Phase 1/2/3 scope boundary): for each `eligible`, above-threshold opportunity in `data/jobs.generated.json`, a daily job drafts a tailored CV variant and a cover letter using the OpenAI API — and stops there. **It never submits anything.**

## What this does and does not do

- Generates a **reordered/emphasis-adjusted CV variant** and a **drafted cover letter** per eligible opportunity, as reviewable PDFs plus a summary.
- Does **not** submit applications, fill out forms, bypass CAPTCHAs/bot protection, or interact with any employer's site. The output is a package for the candidate to review and send themselves — the direct application link is included in every summary.
- Does **not** invent experience. See "Fact-grounding" below for the two different mechanisms this relies on.

## Where the output lives (and why)

This repository (`thavarshan.com`) is **public**. Tailored, per-employer cover letters and CVs reveal job-search targeting — which companies, what was said to them — that shouldn't be permanently public alongside the portfolio site. So generated packages are **never committed here**. They're pushed to a separate **private** repository (`APPLICATIONS_REPO_SLUG`, default `Thavarshan/job-applications`) by `scripts/applications/private-repo.ts`, over SSH using a **deploy key** scoped to only that one repo (`APPLICATIONS_REPO_DEPLOY_KEY`). A deploy key was used instead of a personal access token specifically because it's narrower: it can only perform git operations against the repo it was added to and can never call the GitHub API at all, versus a PAT's broader (if still repo-scoped) reach.

`data/jobs.generated.json` itself (company names, scores, eligibility) is already public and treated as acceptable pre-existing exposure — a portfolio site showing active job-search activity isn't new information. What's protected here is specifically the AI-drafted application *content*.

## Fact-grounding: two different guarantees

1. **CV tailoring is pure selection/reordering, never new prose.** The model returns a structured plan: an order for the 4 existing skill categories, an order for experience entries, and — per role — an ordered subset of that role's own existing `highlights` strings. `lib/application-tailoring.ts`'s `validateCvTailoringPlan` enforces this as a hard constraint: any suggested highlight that isn't an exact (whitespace-normalized) match for a real highlight in `data/profile.generated.json` is dropped, not trusted; any experience entry the model tries to omit is appended back — nothing can disappear or be invented. The CV's professional summary is never rewritten; it's kept verbatim from the verified profile.
2. **The cover letter is inherently new prose** (it has to reference the specific employer). `lib/hallucination-check.ts`'s `scanForUnlistedTerms` heuristically flags proper-noun-like phrases that appear in neither the candidate's profile nor the target job's own posting data (company/title/tags — legitimately expected to be mentioned). Flagged terms are surfaced prominently in the generated `summary.md` for human review, not silently corrected — a human reviewing before sending is the actual gate, so flag-and-show is more honest than a heuristic attempting to "fix" prose.

## Selection and cost controls

A candidate opportunity qualifies when `eligibility === "eligible"`, `status !== "closed"`, and `score >= APPLICATIONS_MIN_SCORE` (default 60). `unknown` eligibility is never sufficient — this mirrors `docs/jobs-data.md`'s existing rule that `unknown` is never permission to act. Already-generated packages are skipped unless the underlying job data materially changed (tracked via a content hash in the private repo's `state.json`), and each run is capped at `APPLICATIONS_MAX_PER_RUN` (default 5) new/regenerated packages regardless of how many candidates qualify.

## Required secrets

- `OPENAI_API_KEY` — used only to call the OpenAI API for tailoring/cover-letter drafting.
- `APPLICATIONS_REPO_DEPLOY_KEY` — an ed25519 SSH private key. The matching public key is registered as a **write-access deploy key** on `Thavarshan/job-applications` only (`gh repo deploy-key list --repo Thavarshan/job-applications`) — it grants no access to any other repo and no GitHub API access at all. Regenerate by creating a new keypair, adding the public half via `gh repo deploy-key add`, and replacing this secret.

If either secret is missing, `npm run applications:generate` logs a message and exits cleanly (no-op) — the workflow is safe to merge before secrets exist. Prefer setting secret values via `gh secret set` or the GitHub UI directly rather than pasting them into chat with an assistant — the conversation transcript is a persistent record.

## Per-package contents (in the private repo, under `<opportunityId>/`)

- `cv.pdf` — tailored CV variant (same rendering pipeline and page-limit/content verification as the public CV, see `scripts/cv/verify.ts`).
- `cover-letter.pdf` — AI-drafted cover letter.
- `summary.md` — job title/company, direct application link, score/eligibility/work arrangement/salary, why it was selected, any flagged terms to double-check, and generation metadata (timestamp, model, content hash).

## Operational notes

- Reuses the exact same Docker + `latexmk` compilation pipeline as the public CV (`scripts/cv/build.ts`'s `compileLatexToPdf`), just with a tailoring plan and different output paths — the untailored `npm run cv:build` path is unaffected.
- A source or OpenAI failure for one candidate is caught and logged; it doesn't abort the run or affect other candidates.
- The private repo's `state.json` and this workflow's own log output only ever mention information already public via `data/jobs.generated.json` (company, title, score) — never cover letter content.
