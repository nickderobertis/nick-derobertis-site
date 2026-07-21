#!/usr/bin/env bash
set -euo pipefail
project="${1:-}"
if [[ ! "$project" =~ ^[a-z][a-z0-9-]*$ ]] || [[ ! -f "apps/$project/project.json" ]]; then
  printf 'visual-project: expected a valid Nx project name; try: just visual-project bio\n' >&2
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
    if ! docker run --rm --platform=linux/amd64 --ipc=host --shm-size=2g --user "$(id -u):$(id -g)" -e SCREENCOMP_CAPTURE_CONTAINER=1 -v "$PWD:/work" -w /work mcr.microsoft.com/playwright:v1.61.1-noble node scripts/capture-visual.mjs "$project" "$output"; then
      printf 'visual-project: pinned Docker capture failed for %s; ensure Docker is available, then rerun just visual-project %s\n' "$project" "$project" >&2
      exit 1
    fi
  fi
}
capture "$current"
capture "$verify"
if ! screencomp verify --quiet --first "apps/$project/visual/current" --second "apps/$project/visual/verify" --arch "$arch"; then
  printf 'visual-project: capture was not reproducible; rerun just visual-project %s in the pinned container and inspect both capture trees\n' "$project" >&2
  exit 1
fi
if ! screencomp doctor --quiet --input "apps/$project/visual/current" --arch "$arch" --exit-code; then
  printf 'visual-project: capture metadata is invalid; inspect apps/%s/visual/current/%s/captures.json and rerun the target\n' "$project" "$arch" >&2
  exit 1
fi
if [[ ! -f "$baseline" ]]; then
  printf 'visual-project: missing baseline %s; seed it with screencomp manifest\n' "$baseline" >&2
  exit 1
fi
status=0
classification=$(screencomp classify --baseline-manifest "$baseline" --current "apps/$project/visual/current" --arch "$arch" --exit-code 2>&1) || status=$?
if [[ "$status" -eq 3 && "${SCREENCOMP_DEFER_DRIFT:-}" == "1" ]]; then
  printf '%s\n' "$project" > "apps/$project/visual/drift"
  exit 0
fi
if [[ "$status" -ne 0 ]]; then
  printf '%s\nvisual-project: visual drift or classification failure for %s; review the details above, then intentionally update its baseline or fix the capture\n' "$classification" "$project" >&2
fi
exit "$status"
