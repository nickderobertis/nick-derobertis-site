#!/usr/bin/env bash
# llmlint: ignore-file[changed_behavior_has_e2e] This developer session hook has no browser interface; ci-tools-contract.spec.ts drives its setup failure boundary and the delegated just recipe owns the installer behavior.
set -euo pipefail
[[ "${CI:-}" == "true" ]] && exit 0
command -v just >/dev/null || "$(dirname "$0")/install-just.sh" || { echo "session-setup: just installation failed; resolve the install-just diagnostic above and restart the session" >&2; exit 1; }
just setup-llmlint || { echo "session-setup: llmlint setup failed; rerun just setup-llmlint after resolving the diagnostic above" >&2; exit 1; }
