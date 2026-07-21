#!/usr/bin/env bash
set -euo pipefail
if [[ "$#" -ne 5 ]]; then
  printf 'publish-visual-project: usage: <baseline> <current> <gallery> <comment> <gallery-url>\n' >&2
  exit 2
fi
baseline="$1"
current="$2"
gallery="$3"
comment="$4"
gallery_url="$5"
workspace=$(realpath .)
baseline=$(realpath "$baseline" 2>/dev/null || true)
current=$(realpath "$current" 2>/dev/null || true)
gallery=$(realpath -m "$gallery")
comment=$(realpath -m "$comment")
for input in "$baseline" "$current" "$gallery" "$comment"; do
  if [[ -z "$input" || "$input" != "$workspace/"* ]]; then
    printf 'publish-visual-project: all paths must resolve inside the workspace; remove traversal or absolute external paths and retry\n' >&2
    exit 2
  fi
done
if [[ ! -f "$baseline" ]] || [[ ! -f "$current/x86_64/captures.json" ]]; then
  printf 'publish-visual-project: baseline or current capture is missing; run the owning screenshot target before publishing\n' >&2
  exit 2
fi
if [[ ! "$gallery_url" =~ ^https://[A-Za-z0-9._/-]+$ ]]; then
  printf 'publish-visual-project: gallery URL must be an HTTPS Pages URL\n' >&2
  exit 2
fi
status=0
classification=$(screencomp classify --baseline-manifest "$baseline" --current "$current" --arch x86_64 --exit-code 2>&1) || status=$?
if [[ "$status" -ne 0 && "$status" -ne 3 ]]; then
  printf '%s\npublish-visual-project: classification failed; validate the baseline and current captures with screencomp doctor\n' "$classification" >&2
  exit "$status"
fi
if [[ "$status" -eq 3 ]]; then
  printf '%s\npublish-visual-project: intentional visual drift detected; review the gallery and update the baseline only after approval\n' "$classification" >&2
fi
gallery_output=$(screencomp gallery --input "$current" --arch x86_64 --output "$gallery" 2>&1) || {
  printf '%s\npublish-visual-project: gallery build failed; validate the current captures with screencomp doctor and retry\n' "$gallery_output" >&2
  exit 1
}
comment_output=$(screencomp comment --baseline-manifest "$baseline" --current "$current" --arch x86_64 --gallery-url "$gallery_url" --output "$comment" 2>&1) || {
  printf '%s\npublish-visual-project: comment build failed; validate the baseline manifest and retry\n' "$comment_output" >&2
  exit 1
}
exit "$status"
