#!/usr/bin/env bash
set -euo pipefail
# Fixed official release archives; verify before running any downloaded code.
ci_tools_dir="$(mktemp -d)"
trap 'rm -rf "$ci_tools_dir"' EXIT
install_tool() {
  local name="$1" url="$2" digest="$3"
  curl --fail --silent --show-error --location --retry 2 --max-time 60 "$url" -o "$ci_tools_dir/$name.tgz"
  printf '%s  %s\n' "$digest" "$ci_tools_dir/$name.tgz" | sha256sum --check --status
  tar --no-same-owner -xzf "$ci_tools_dir/$name.tgz" -C "$ci_tools_dir" "$name"
}
install_tool actionlint https://github.com/rhysd/actionlint/releases/download/v1.7.12/actionlint_1.7.12_linux_amd64.tar.gz 8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8
install_tool gitleaks https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_linux_x64.tar.gz 551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb
"$ci_tools_dir/actionlint" -shellcheck=""
node --import tsx automation/ci/workflow-pins.ts
# Prove detection and redaction using an ephemeral token; no token enters repository or logs.
mkdir "$ci_tools_dir/fixture"
python3 - "$ci_tools_dir/fixture/token.txt" <<'PY'
import pathlib, sys
pathlib.Path(sys.argv[1]).write_text('token = "' + 'gh' + 'p_' + 'A1b2C3d4' * 5 + '"\n')
PY
set +e
"$ci_tools_dir/gitleaks" dir "$ci_tools_dir/fixture" --redact=100 --no-banner --report-format json --report-path "$ci_tools_dir/fixture.json" >"$ci_tools_dir/fixture.log" 2>&1
fixture_status=$?
set -e
if [ "$fixture_status" -ne 1 ]; then echo "Secret scanner failed its synthetic detection check"; exit 1; fi
python3 - "$ci_tools_dir/fixture.json" "$ci_tools_dir/fixture.log" <<'PY'
import json, pathlib, sys
report = json.loads(pathlib.Path(sys.argv[1]).read_text())
assert report and all(item['Secret'] == 'REDACTED' for item in report), 'Scanner report was not redacted'
for path in sys.argv[1:]:
    assert 'A1b2C3d4' not in pathlib.Path(path).read_text(), 'Scanner output disclosed fixture token'
PY
# Scan the current tracked tree plus every commit since adoption. Earlier history is legacy debt,
# not silently allowlisted. Copy tracked/unignored files, excluding local dependency/build artifacts.
mkdir "$ci_tools_dir/tree"
git ls-files -z --cached --others --exclude-standard | tar --null --no-recursion -T - -cf - | tar --no-same-owner -xf - -C "$ci_tools_dir/tree"
set +e
"$ci_tools_dir/gitleaks" dir "$ci_tools_dir/tree" --redact=100 --no-banner --report-format json --report-path "$ci_tools_dir/current.json"
scan_status=$?
set -e
if [ "$scan_status" -ne 0 ]; then
  python3 - "$ci_tools_dir/current.json" "$ci_tools_dir/tree/" <<'PYREPORT'
import json, sys
for item in json.load(open(sys.argv[1])):
    print(item['File'].removeprefix(sys.argv[2]), item['StartLine'], item['RuleID'])
PYREPORT
  exit "$scan_status"
fi
"$ci_tools_dir/gitleaks" git . --log-opts="c088933cd726e709c4b10b18cbf0a59dac2d969f..HEAD" --redact=100 --no-banner
