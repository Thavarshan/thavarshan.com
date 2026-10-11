#!/usr/bin/env bash
set -euo pipefail
# Called only by trusted main automation, with literal purpose/title/path arguments.
purpose="$1"
title="$2"
shift 2
if [[ ! "$purpose" =~ ^[a-z-]+$ ]] || [ "$#" -eq 0 ]; then echo "Invalid generated-content publication arguments"; exit 1; fi
if [ "${GITHUB_REF:-}" != refs/heads/main ]; then echo "Generated content may only be proposed from main"; exit 1; fi
# Narrative, profile claims and review approvals are human-maintained. Never stage them in scheduled publication.
allowed_argument() {
  case "$purpose:$1" in
    profile:data/github.generated.json|profile:data/package-registry.generated.json|profile:cv/generated/Jerome-Resume.tex|profile:public/docs/Jerome-Resume.pdf|jobs:data/jobs.generated.json|growth:data/growth|growth-health:data/growth-health/baseline.json|oss:marketing/oss|oss:marketing/oss-ledger.json) return 0 ;;
    *) return 1 ;;
  esac
}
allowed_staged() {
  if allowed_argument "$1"; then return 0; fi
  if [ "$purpose" = growth ] && [[ "$1" =~ ^data/growth/[a-zA-Z0-9._-]+\.json$ ]]; then return 0; fi
  if [ "$purpose" = oss ] && [[ "$1" =~ ^marketing/oss/[a-zA-Z0-9/._-]+\.(md|json)$ ]]; then return 0; fi
  return 1
}
for path in "$@"; do
  if ! allowed_argument "$path"; then echo "Refusing non-generated publication path"; exit 1; fi
done
if ! git diff --cached --quiet; then echo "Refusing a pre-staged publication index"; exit 1; fi
prefix="automation/generated-${purpose}-"
pending="$(gh pr list --base main --state open --json headRefName --jq "[.[] | select(.headRefName | startswith(\"$prefix\"))] | length")"
if [ "$pending" != 0 ]; then
  echo "A generated $purpose PR is already awaiting review; merge or close it before the next refresh."
  exit 0
fi
git add -- "$@"
while IFS= read -r -d '' path; do
  if ! allowed_staged "$path"; then echo "Refusing unexpected generated file"; exit 1; fi
done < <(git diff --cached --name-only -z)
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
