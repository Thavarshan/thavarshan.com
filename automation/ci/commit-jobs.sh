#!/usr/bin/env bash
set -euo pipefail
# Only trusted main automation may publish the already validated public job snapshot.
if [ "${GITHUB_REF:-}" != refs/heads/main ]; then
  echo "Job snapshots may only be committed from main"
  exit 1
fi
if ! git diff --cached --quiet; then
  echo "Refusing publication with unrelated staged changes"
  exit 1
fi
if git diff --quiet -- data/jobs.generated.json; then
  echo "No Laravel job opportunity changes detected."
  exit 0
fi
base="$(git rev-parse HEAD)"
git fetch origin main
if [ "$(git rev-parse FETCH_HEAD)" != "$base" ]; then
  echo "Main changed during collection; rerun the refresh against current main."
  exit 1
fi
git add -- data/jobs.generated.json
git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git commit -m "Refresh Laravel job opportunities"
# Fast-forward only. A concurrent main update rejects the push; never force or rebase
# a snapshot whose validation ran against different code/profile inputs.
git push origin HEAD:refs/heads/main
echo "Validated Laravel jobs committed directly to main: $(git rev-parse HEAD)"
# GITHUB_TOKEN pushes suppress normal push events; dispatch CI explicitly. Its successful
# main run also triggers the existing revision-aware production smoke workflow.
gh workflow run ci.yml --ref main
