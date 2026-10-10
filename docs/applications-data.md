# Application preparation packages

The daily application workflow prepares private CV and cover-letter drafts from the existing job/profile/project snapshots. **Scheduled runs use Groq Free AI; explicit template mode makes no provider calls. Nothing is submitted, emailed or posted to an employer.**

## Selection and manual use

Scheduled runs select open `eligible` opportunities at or above `APPLICATIONS_MIN_SCORE` (60 by default), up to `APPLICATIONS_MAX_PER_RUN` (default and maximum 5). In GitHub Actions, select **Refresh Application Packages → Run workflow**, leave `mode` as `ai` (or explicitly choose `template` for deterministic recovery), and optionally paste an opportunity's 20-character hexadecimal `id` from `data/jobs.generated.json` into `job_id`. Whitespace and uppercase are normalized; an unknown, closed or ineligible/unknown-eligibility ID fails before opening private storage. Explicit selection can bypass the score threshold, but never eligibility or the terminal `applied` state.

CLI equivalent: `APPLICATIONS_JOB_ID=<snapshot-id> npm run applications:generate`. Docker must be available for the pinned LaTeX compiler. The workflow uses the existing compiler and private publisher; there is no separate application service.

## Facts and trust boundaries

Template preparation compares literal skill names with the title, source tags and description. It cites the verified skill list, exact role highlights and project descriptions. Skill-name overlap is **not** proof of proficiency, years of experience or satisfaction of every requirement. Unsupported tags remain gaps. Up to ten bounded excerpts mentioning explicit requirements, years, authorization, sponsorship or salary are marked unverified for manual confirmation; matching a skill never confirms those requirements. Descriptions are not exhaustively parsed: review the original posting for mandatory years, credentials, languages and other requirements. Unknown sponsorship/location, work authorization and salary expectations remain questions; the template never creates candidate claims about them.

CV changes select/reorder existing categories, roles and verbatim highlights through `validateCvTailoringPlan`; all roles remain and dates/summary stay unchanged. The template letter contains verified highlights (or the verified profile summary when none match) and fixed neutral prose. Posting text is data, never instructions. Markdown posting fields are escaped and application/source URLs must use HTTP(S). No posting URL is fetched or employer site contacted by the generator.

## Groq Free setup and limits

1. Sign in to [Groq Console](https://console.groq.com/keys), remain on **Free**, and create a project API key. Do not add billing or upgrade to Developer. Check the plan in the console; an inference request cannot prove billing status.
2. Enable **Zero Data Retention** under Settings → Data Controls before sending profile facts. See [Groq data controls](https://console.groq.com/docs/your-data).
3. Save the key only in this repository's Actions secret `GROQ_API_KEY`. After verifying the Free plan, set repository variable `GROQ_FREE_PLAN_CONFIRMED=true`. This is an owner assertion, not an API-enforced billing lock; recheck it if account configuration changes.
4. Install the private destination write deploy key described below. Set `APPLICATIONS_AUTOMATION_ENABLED=false` to explicitly disable generation while retaining a truthful disabled summary; restore `true` to resume.

The existing OpenAI SDK calls only Groq's fixed `https://api.groq.com/openai/v1` endpoint and `openai/gpt-oss-20b`. There is no paid OpenAI route or automatic provider/template fallback. Missing secrets, unconfirmed Free status, unsupported model overrides, authentication/model-access/quota errors and timeouts fail the run. A small inference probe validates authentication, model access and current quota even on unchanged-input runs; it does not certify billing, complete-package quality or sufficient quota for every later request.

[Published Free quotas](https://console.groq.com/docs/rate-limits), checked 2026-10-10, are 30 requests/minute, 1,000/day, 8,000 tokens/minute and 200,000/day for this model. Actual account limits and other usage can reduce available allowance. Requests start at least 65 seconds apart, use a 60-second timeout and retry at most once for HTTP 5xx only. Authentication, quota and timeout failures stop immediately. Each run caps at 11 requests (including probe/retries), five packages, 5,000 estimated input tokens and 2,500 maximum completion tokens per package; reasoning tokens count toward completion. The local `o200k_base` estimate includes schema plus a 512-token framing reserve, but does not guarantee provider quota accounting. Oversized inputs fail rather than silently dropping profile facts. Quota failures require waiting/reducing usage, never upgrading.

Groq returns [strict JSON-schema output](https://console.groq.com/docs/structured-outputs), which also passes local bounded validation. AI CV plans must retain every role exactly once and reference known roles/categories. The model selects bounded indices into each role’s verified highlights; the client copies the original text itself and rejects unknown roles, out-of-range indices or duplicates; invalid plans fail the entire run. Cover-letter proper-noun flags are advisory heuristics and require human review: schema and CV validation cannot establish every prose claim's accuracy. `preparation.md` remains deterministic evidence even in AI mode; the AI letter is in the PDF. See [cost policy](cost-policy.md).

CLI AI use requires `APPLICATIONS_MODE=ai`, `GROQ_API_KEY`, `GROQ_FREE_PLAN_CONFIRMED=true` and the private deploy key in the environment. CLI defaults to template; scheduled/manual workflow defaults to AI. Public Actions summaries distinguish disabled, no-op, published and failed outcomes, the failure stage and aggregate provider-reported token usage. They omit private package contents, identifiers and review counts.


## Private output and configuration

This website repository is public. Drafts go only to the existing separate **private** repository (`APPLICATIONS_REPO_SLUG`, default `Thavarshan/job-applications`) via `APPLICATIONS_REPO_DEPLOY_KEY`, an SSH write deploy key scoped to that destination. Before enabling generation, the owner must verify that destination remains private and install its deploy key. The key cannot inspect repository visibility through the API; the generator rejects this public website as a destination, but cannot certify other repositories' visibility. No broader token is introduced.

Template mode needs only that deploy key, not a Groq key. Missing deploy keys fail every enabled run visibly. Generated content is never uploaded as a public Actions artifact or committed to the website.

Each private `<opportunityId>/` package contains:

- `cv.pdf` — selected/reordered CV.
- `cover-letter.pdf` — reviewable template or optional AI draft.
- `preparation.md` — job/eligibility/fit summary, canonical/source/application links, evidence matrix, gaps, CV suggestions, interview preparation and template letter.
- `summary.md` — metadata, selection reasons and review flags, compatible with the existing review tool.

The private `state.json` records the input hash, generator/model, generation time and review status. Hashes include the job's meaningful data, verified profile, project snapshot and mode/version, so changes to evidence invalidate pending packages. Polling-only first/last-seen timestamps do not. `applied` is terminal; `skipped` can regenerate after changed input.

## Retention, failures and recovery

Keep only the pending/relevant packages you need in the private repository; delete reviewed drafts when no longer useful. Private Git history retains previous committed content until the owner explicitly purges it; deleting a file does not erase history. No automatic destructive history rewrite is performed. Keep minimal status records to preserve the terminal applied guard. Local `.applications-build` and the temporary `.applications-private` clone are removed in `finally` after success or failure. The interactive review clone is separate and is not removed. No generated content is logged: compiler and private git output are captured, and errors are generic.

Malformed snapshots or private state fail closed; they never reset review history. If any package fails, no changes from that run are pushed. Correct the snapshot/configuration or restore a valid private `state.json`, then rerun the same job ID. Compilation/provider failures leave prior committed packages/state intact; push failures can be checked in private Git history before retrying. The workflow uses one concurrency group to prevent competing publishers.

## Human review

Clone the private destination using your own GitHub credentials and run `npm run applications:review -- /path/to/clone`. Read PDFs and both Markdown files, verify every claim and unresolved requirement, then decide whether to send the application yourself. The tool marks `a` as applied, `s` as skipped, or `q` to leave pending, and pushes state using your ambient credentials. It does not open employer pages or submit forms. `pending → applied` is terminal; `pending → skipped` records the decision on that version.
