#!/usr/bin/env bash
set -euo pipefail
# Called only by trusted main automation, with literal purpose/title/path arguments.
purpose="$1"
title="$2"
shift 2
if [[ ! "$purpose" =~ ^[a-z-]+$ ]] || [ "$#" -eq 0 ]; then echo "Invalid generated-content publication arguments"; exit 1; fi
if [ "${GITHUB_REF:-}" != refs/heads/main ]; then echo "Generated content may only be proposed from main"; exit 1; fi
prefix="automation/generated-${purpose}-"
pending="$(gh pr list --base main --state open --json headRefName --jq "[.[] | select(.headRefName | startswith(\"$prefix\"))] | length")"
if [ "$pending" != 0 ]; then
  echo "A generated $purpose PR is already awaiting review; merge or close it before the next refresh."
  exit 0
fi
git add -- "$@"
if git diff --cached --quiet; then echo "No generated changes to propose."; exit 0; fi
git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git commit -m "$title"
# Unique branches, fast-forward push only: never overwrite a previous PR or main.
branch="${prefix}${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}"
git push origin "HEAD:refs/heads/$branch"
body_file="$(mktemp)"
trap 'rm -f "$body_file"' EXIT
cat > "$body_file" <<'BODY'
Updates generated public content from the trusted main automation. Review the snapshot diff before merging.

CI is explicitly dispatched for this branch because events authored with the default GitHub token do not trigger normal PR CI. The required `ci-gate` must succeed before merge.
BODY
gh pr create --base main --head "$branch" --title "$title" --body-file "$body_file"
# workflow_dispatch is an exception to GITHUB_TOKEN's normal event recursion suppression.
gh workflow run ci.yml --ref "$branch"
