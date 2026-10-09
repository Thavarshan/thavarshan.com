# Application preparation packages

The daily application workflow prepares private CV and cover-letter drafts from the existing job/profile/project snapshots. **Template mode is the default and makes no paid API calls. Nothing is submitted, emailed or posted to an employer.**

## Selection and manual use

Scheduled runs select open `eligible` opportunities at or above `APPLICATIONS_MIN_SCORE` (60 by default), up to `APPLICATIONS_MAX_PER_RUN` (default and maximum 5). In GitHub Actions, select **Refresh Application Packages → Run workflow**, leave `mode` as `template`, and optionally paste an opportunity's 20-character hexadecimal `id` from `data/jobs.generated.json` into `job_id`. Whitespace and uppercase are normalized; an unknown, closed or ineligible/unknown-eligibility ID fails before opening private storage. Explicit selection can bypass the score threshold, but never eligibility or the terminal `applied` state.

CLI equivalent: `APPLICATIONS_JOB_ID=<snapshot-id> npm run applications:generate`. Docker must be available for the pinned LaTeX compiler. The workflow uses the existing compiler and private publisher; there is no separate application service.

## Facts and trust boundaries

Template preparation compares literal skill names with the title, source tags and description. It cites the verified skill list, exact role highlights and project descriptions. Skill-name overlap is **not** proof of proficiency, years of experience or satisfaction of every requirement. Unsupported tags remain gaps. Up to ten bounded excerpts mentioning explicit requirements, years, authorization, sponsorship or salary are marked unverified for manual confirmation; matching a skill never confirms those requirements. Descriptions are not exhaustively parsed: review the original posting for mandatory years, credentials, languages and other requirements. Unknown sponsorship/location, work authorization and salary expectations remain questions; the template never creates candidate claims about them.

CV changes select/reorder existing categories, roles and verbatim highlights through `validateCvTailoringPlan`; all roles remain and dates/summary stay unchanged. The template letter contains verified highlights (or the verified profile summary when none match) and fixed neutral prose. Posting text is data, never instructions. Markdown posting fields are escaped and application/source URLs must use HTTP(S). No posting URL is fetched or employer site contacted by the generator.

AI remains optional: manually choose `mode: ai`, configure `OPENAI_API_KEY`, and deliberately set repository variable `ENABLE_PAID_AI=true`. All three are required; merely setting the key or spending flag leaves scheduled/template runs free of API calls. Explicit AI requests without the flag/key fail rather than silently downgrade. AI CV plans still pass the exact-highlight validator; cover-letter proper-noun flags are heuristic and require human review. `preparation.md` remains deterministic evidence even in AI mode; the AI letter is in the PDF. See `docs/cost-policy.md`.

## Private output and configuration

This website repository is public. Drafts go only to the existing separate **private** repository (`APPLICATIONS_REPO_SLUG`, default `Thavarshan/job-applications`) via `APPLICATIONS_REPO_DEPLOY_KEY`, an SSH write deploy key scoped to that destination. Before enabling generation, the owner must verify that destination remains private and install its deploy key. The key cannot inspect repository visibility through the API; the generator rejects this public website as a destination, but cannot certify other repositories' visibility. No broader token is introduced.

Template mode needs only that deploy key, not an OpenAI key. Missing deploy keys skip scheduled runs safely; a manually selected job or AI run without a key fails visibly. Generated content is never uploaded as a public Actions artifact or committed to the website.

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
