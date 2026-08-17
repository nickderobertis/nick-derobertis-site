#!/usr/bin/env bash
# llmlint: ignore-file[changed_behavior_has_e2e] This developer bootstrap step has no browser interface; ci-tools-contract.spec.ts drives the real script as a subprocess over both release-document shapes and every rejection it reports.
set -euo pipefail
# Reads a GitHub release document on stdin and prints its release tag.
#
# The document's line breaks are not ours to rely on: an intermediary may
# re-serialize the response onto a single line, and a line-oriented parse then
# reads whichever field happens to come first — the API URL — and installs from
# a 404 that names it. Match the field by name so the shape of the document
# cannot change which field is read, then confirm the result really is a tag.
document="$(cat)"
tag="$(
  printf '%s' "$document" |
    grep -o '"tag_name"[[:space:]]*:[[:space:]]*"[^"]*"' |
    sed -n '1s/.*"\([^"]*\)"$/\1/p'
)" || tag=""
[[ "$tag" =~ ^v?[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "resolve-just-tag: expected a release tag like '1.58.0' under \"tag_name\"; received '$tag'. Check that https://api.github.com/repos/casey/just/releases/latest answered with a release document rather than an error or a redirect, then retry" >&2; exit 1; }
printf '%s\n' "$tag"
