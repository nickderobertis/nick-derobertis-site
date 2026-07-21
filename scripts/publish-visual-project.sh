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
status=0
screencomp classify --quiet --baseline-manifest "$baseline" --current "$current" --arch x86_64 --exit-code || status=$?
if [[ "$status" -ne 0 && "$status" -ne 3 ]]; then
  printf 'publish-visual-project: classification failed; validate the baseline and current captures with screencomp doctor\n' >&2
  exit "$status"
fi
screencomp gallery --quiet --input "$current" --arch x86_64 --output "$gallery"
screencomp comment --quiet --baseline-manifest "$baseline" --current "$current" --arch x86_64 --gallery-url "$gallery_url" --output "$comment"
exit "$status"
