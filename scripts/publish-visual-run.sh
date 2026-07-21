#!/usr/bin/env bash
set -euo pipefail
artifact_root="${1:-}"
event_name="${2:-}"
pr_number="${3:-}"
base_ref="${4:-}"
repository="${5:-}"
publication_root="${6:-.}"
[[ -d "$artifact_root" ]] || { echo "publish-visual-run: artifact root is missing" >&2; exit 2; }
[[ -d "$publication_root" ]] || { echo "publish-visual-run: publication root is missing" >&2; exit 2; }
affected_file="$artifact_root/affected-visual-projects.txt"
affected_size=$(stat -c '%s' "$affected_file" 2>/dev/null || true)
if [[ ! -f "$affected_file" || -L "$affected_file" || ! "$affected_size" =~ ^[0-9]+$ ]] || (( affected_size > 1048576 )); then
  echo "publish-visual-run: affected-project control file is missing, unsafe, or oversized; rerun the capture workflow to create a validated visual-captures artifact" >&2
  exit 2
fi
[[ "$event_name" == "pull_request" || "$event_name" == "push" ]] || { echo "publish-visual-run: unsupported source event" >&2; exit 2; }
[[ "$repository" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || { echo "publish-visual-run: invalid repository" >&2; exit 2; }
mkdir -p "$publication_root/site"
rm -f "$publication_root/.visual-drift"
printf '%s\n## Visual changes\n\n' '<!-- screencomp -->' > "$publication_root/comment.md"
gallery_prefix="https://${repository%/*}.github.io/${repository#*/}"
if [[ "$event_name" == "pull_request" ]]; then
  [[ "$pr_number" =~ ^[1-9][0-9]*$ ]] || { echo "publish-visual-run: invalid pull-request number" >&2; exit 2; }
  git check-ref-format --branch "$base_ref" >/dev/null || { echo "publish-visual-run: invalid base ref" >&2; exit 2; }
  gallery_prefix="$gallery_prefix/pr-$pr_number"
fi
while IFS= read -r project; do
  [[ "$project" =~ ^[a-z][a-z0-9-]*$ ]] || { echo "publish-visual-run: invalid affected project" >&2; exit 2; }
  current="$artifact_root/apps/$project/visual/current"
  doctor_output=$(screencomp doctor --input "$current" --arch x86_64 --exit-code 2>&1) || {
    printf '%s\npublish-visual-run: screencomp rejected the validated captures for %s; rerun the unprivileged capture workflow\n' "$doctor_output" "$project" >&2
    exit 2
  }
  manifest="apps/$project/visual/baseline/x86_64.json"
  comparison="$manifest"
  if [[ "$event_name" == "pull_request" ]] && git show "origin/$base_ref:$manifest" > "$publication_root/base.json" 2>/dev/null; then
    comparison="$publication_root/base.json"
  fi
  status=0
  just visual-publish-project "$comparison" "$current" "$publication_root/site/$project" "$publication_root/project-comment.md" "$gallery_prefix/$project" || status=$?
  if [[ "$status" -eq 3 ]]; then
    touch "$publication_root/.visual-drift"
  elif [[ "$status" -ne 0 ]]; then
    exit "$status"
  fi
  if [[ "$event_name" == "pull_request" ]]; then
    sed '/<!-- screencomp-/d' "$publication_root/project-comment.md" >> "$publication_root/comment.md"
    printf '\n' >> "$publication_root/comment.md"
  fi
done < "$affected_file"
