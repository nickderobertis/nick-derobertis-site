#!/usr/bin/env bash
# llmlint: ignore-file[changed_behavior_has_e2e] This developer bootstrap step has no browser interface; ci-tools-contract.spec.ts drives the real script as a subprocess over both release-document shapes and every rejection it reports.
set -euo pipefail
# Reads a GitHub release document on stdin and prints its release tag.
#
# Stdin carries whatever the API answered with — a release, a rate-limit error,
# a 404 page — so establish the body really is a release document before taking
# a tag from it: parse it as JSON, hold it to the release shape, then read the
# tag by name. Searching the raw text for a tag-shaped substring instead accepts
# any body that happens to contain one, and, because an intermediary may
# re-serialize the response onto a single line, a line-oriented search reads
# whichever field comes first — the API URL — and installs from a 404 naming it.
command -v node >/dev/null || {
  echo "resolve-just-tag: node is required to read the release document; install Node.js, then retry" >&2
  exit 1
}
tag="$(
  node -e '
    const source = "https://api.github.com/repos/casey/just/releases/latest";
    const fail = (reason) => {
      console.error("resolve-just-tag: " + reason + "; check that " + source + " answered with a release document rather than an error or a redirect, then retry");
      process.exit(1);
    };
    const body = require("node:fs").readFileSync(0, "utf8");
    let release;
    try { release = JSON.parse(body); } catch { fail("the response body is not JSON, so it is not a GitHub release document"); }
    if (release === null || typeof release !== "object" || Array.isArray(release)) fail("the response body is JSON, but not the object a GitHub release document is");
    const shape = { tag_name: "string", html_url: "string", assets_url: "string", id: "number" };
    const absent = Object.entries(shape).filter(([field, type]) => typeof release[field] !== type).map(([field]) => field);
    if (absent.length > 0) fail("the response is not a GitHub release document; these release fields are missing or mistyped: " + absent.join(", "));
    if (!/^v?\d+\.\d+\.\d+$/.test(release.tag_name)) fail("the tag_name in the release document is " + JSON.stringify(release.tag_name) + ", which is not a release tag like 1.58.0");
    process.stdout.write(release.tag_name);
  '
)" || exit 1
printf '%s\n' "$tag"
