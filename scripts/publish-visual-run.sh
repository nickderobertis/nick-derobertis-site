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
done < "$artifact_root/affected-visual-projects.txt"
