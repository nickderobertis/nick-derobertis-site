#!/usr/bin/env bash
set -euo pipefail

project="${1:-}"
target="${2:-}"
[[ "$project" =~ ^[a-z][a-z0-9-]*$ && "$target" =~ ^[a-z][a-z0-9-]*$ && $# -ge 3 ]] || {
  echo "run-tooling-target: expected <project> <target> <command...>; fix the owning project.json command and rerun just check" >&2
  exit 2
}
shift 2

log=$(mktemp)
trap 'rm -f "$log"' EXIT
"$@" >"$log" 2>&1 || {
  cat "$log" >&2
  echo "run-tooling-target: tooling-$project:$target failed; fix the diagnostics above and rerun just check" >&2
  exit 1
}
