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
# Test the exact commit before advancing protected main. The default token can
# dispatch workflows, but its pushes do not trigger CI automatically.
revision="$(git rev-parse HEAD)"
branch="automation/checked-jobs-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}"
git push origin "HEAD:refs/heads/$branch"
gh workflow run ci.yml --ref "$branch"
verified=false
for attempt in {1..180}; do
  run_id="$(gh run list --workflow ci.yml --branch "$branch" --commit "$revision" --event workflow_dispatch --limit 1 --json databaseId --jq '.[0].databaseId // empty')"
  if [ -n "$run_id" ]; then
    result="$(gh run view "$run_id" --json status,conclusion,jobs --jq 'if .status != "completed" then "waiting" elif .conclusion == "success" and any(.jobs[]; .name == "ci-gate" and .conclusion == "success") then "verified" else "failed" end')"
    if [ "$result" = failed ]; then
      echo "::error::Job snapshot CI failed: https://github.com/${GITHUB_REPOSITORY}/actions/runs/${run_id}. Main is unchanged."
      exit 1
    fi
    if [ "$result" = verified ]; then verified=true; break; fi
  fi
  sleep 15
done
if [ "$verified" != true ]; then
  echo "::error::Timed out waiting for job snapshot CI. Main is unchanged; inspect $branch."
  exit 1
fi
# Reject concurrent main changes even when CI succeeded. Never rebase tested data.
git fetch origin main
if [ "$(git rev-parse FETCH_HEAD)" != "$base" ]; then
  echo "::error::Main changed while CI ran; rerun job refresh against current main."
  exit 1
fi
# Fast-forward the identical checked revision. Required status checks apply here.
git push origin HEAD:refs/heads/main
echo "Validated Laravel jobs committed directly to main: $(git rev-parse HEAD)"
# GITHUB_TOKEN pushes suppress normal push events; dispatch CI explicitly. Its successful
# main run also triggers the existing revision-aware production smoke workflow.
gh workflow run ci.yml --ref main

# The temporary branch is no longer needed once main CI has been dispatched.
git push origin --delete "$branch"
