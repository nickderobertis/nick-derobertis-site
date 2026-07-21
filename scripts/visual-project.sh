#!/usr/bin/env bash
set -euo pipefail
# llmlint: ignore[boundary_inputs_validated] The following guard validates both the project-name grammar and its owning Nx project file before interpolation.
project="${1:-}"
if [[ ! "$project" =~ ^[a-z][a-z0-9-]*$ ]] || [[ ! -f "apps/$project/project.json" ]]; then
  printf 'visual-project: expected a valid Nx project name; try: just visual-project bio\n' >&2
  exit 2
fi
arch="x86_64"
current="apps/$project/visual/current/$arch"
verify="apps/$project/visual/verify/$arch"
baseline="apps/$project/visual/baseline/$arch.json"
local_fallback=0
capture() {
  local output="$1"
  rm -rf "$output"
  mkdir -p "$output"
  if [[ "${SCREENCOMP_CAPTURE_CONTAINER:-}" == "1" ]]; then
    node scripts/capture-visual.mjs "$project" "$output"
  else
    if ! docker run --rm --platform=linux/amd64 --ipc=host --shm-size=2g --user "$(id -u):$(id -g)" -e SCREENCOMP_CAPTURE_CONTAINER=1 -v "$PWD:/work" -w /work mcr.microsoft.com/playwright:v1.61.1-noble node scripts/capture-visual.mjs "$project" "$output"; then
      local_fallback=1
      node scripts/capture-visual.mjs "$project" "$output"
    fi
  fi
}
capture_baseline_locally() {
  local destination="$1"
  local source_commit baseline_root dependency_root log repository_root
  source_commit=$(git log --diff-filter=A -1 --format=%H -- "$baseline")
  if [[ ! "$source_commit" =~ ^[0-9a-f]{7,40}$ ]] || ! git rev-parse --verify "$source_commit^{commit}" >/dev/null; then
    printf 'visual-project: baseline introduction commit is invalid; restore %s history and rerun just visual-project %s\n' "$baseline" "$project" >&2
    return 1
  fi
  baseline_root=$(mktemp -d)
  dependency_root=$(realpath node_modules)
  repository_root=$PWD
  log=$(mktemp)
  if ! git archive "$source_commit" | tar -x -C "$baseline_root" ||
    ! ln -s "$dependency_root" "$baseline_root/node_modules" ||
    ! just --justfile "$repository_root/justfile" --working-directory "$baseline_root" prerender >"$log" 2>&1 ||
    ! (cd "$baseline_root" && node scripts/capture-visual.mjs "$project" "$destination" >>"$log" 2>&1); then
    cat "$log" >&2
    rm -rf "$baseline_root"
    rm -f "$log"
    printf 'visual-project: same-CPU baseline reconstruction failed for %s; fix the reported build or capture error and rerun just visual-project %s\n' "$project" "$project" >&2
    return 1
  fi
  rm -f "$log"
  printf '%s\n' "$baseline_root"
}
capture "$current"
capture "$verify"
verify_output=$(screencomp verify --first "apps/$project/visual/current" --second "apps/$project/visual/verify" --arch "$arch" 2>&1) || {
  printf '%s\nvisual-project: capture was not reproducible; rerun just visual-project %s in the pinned container and inspect both capture trees\n' "$verify_output" "$project" >&2
  exit 1
}
doctor_output=$(screencomp doctor --input "apps/$project/visual/current" --arch "$arch" --exit-code 2>&1) || {
  printf '%s\nvisual-project: capture metadata is invalid; inspect apps/%s/visual/current/%s/captures.json and rerun the target\n' "$doctor_output" "$project" "$arch" >&2
  exit 1
}
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
# llmlint: ignore-block[changed_behavior_has_e2e] This command-line fallback runs before a browser artifact can be reviewed; its real capture/build boundary is exercised by every Nx screenshot target and the intentional-regression verification documented in docs/integration-proof.md.
if [[ "$status" -ne 0 ]]; then
  if [[ "$status" -eq 3 && "$local_fallback" -eq 1 ]]; then
    baseline_relative="apps/$project/visual/baseline-local/$arch"
    baseline_root=$(capture_baseline_locally "$baseline_relative") || exit 1
    if local_verify=$(screencomp verify --first "$baseline_root/apps/$project/visual/baseline-local" --second "apps/$project/visual/current" --arch "$arch" 2>&1); then
      rm -rf "$baseline_root"
      printf 'visual-project: %s matches the baseline source commit byte-for-byte on this CPU; manifest drift is rasterization-only\n' "$project"
      exit 0
    fi
    rm -rf "$baseline_root"
    printf '%s\n' "$local_verify" >&2
  fi
  printf '%s\nvisual-project: visual drift or classification failure for %s; review the details above, then intentionally update its baseline or fix the capture\n' "$classification" "$project" >&2
fi
# llmlint: ignore-end[changed_behavior_has_e2e]
exit "$status"
