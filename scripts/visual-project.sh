#!/usr/bin/env bash
set -euo pipefail
project="${1:-}"
if [[ ! "$project" =~ ^[a-z][a-z0-9-]*$ ]] || [[ ! -f "apps/$project/project.json" ]]; then
  printf 'visual-project: expected a valid Nx project name\n' >&2
  exit 2
fi
arch="x86_64"
current="apps/$project/visual/current/$arch"
verify="apps/$project/visual/verify/$arch"
baseline="apps/$project/visual/baseline/$arch.json"
capture() {
  local output="$1"
  rm -rf "$output"
  mkdir -p "$output"
  if [[ "${SCREENCOMP_CAPTURE_CONTAINER:-}" == "1" ]]; then
    node scripts/capture-visual.mjs "$project" "$output"
  else
    docker run --rm --platform=linux/amd64 --ipc=host --shm-size=2g --user "$(id -u):$(id -g)" -e SCREENCOMP_CAPTURE_CONTAINER=1 -v "$PWD:/work" -w /work mcr.microsoft.com/playwright:v1.61.1-noble node scripts/capture-visual.mjs "$project" "$output"
  fi
}
capture "$current"
capture "$verify"
screencomp verify --first "apps/$project/visual/current" --second "apps/$project/visual/verify" --arch "$arch"
screencomp doctor --input "apps/$project/visual/current" --arch "$arch" --exit-code
if [[ ! -f "$baseline" ]]; then
  printf 'visual-project: missing baseline %s; seed it with screencomp manifest\n' "$baseline" >&2
  exit 1
fi
status=0
screencomp classify --baseline-manifest "$baseline" --current "apps/$project/visual/current" --arch "$arch" --exit-code || status=$?
if [[ "$status" -eq 3 && "${SCREENCOMP_DEFER_DRIFT:-}" == "1" ]]; then
  printf '%s\n' "$project" > "apps/$project/visual/drift"
  exit 0
fi
exit "$status"
