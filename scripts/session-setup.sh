#!/usr/bin/env bash
set -euo pipefail
[[ "${CI:-}" == "true" ]] && exit 0
command -v just >/dev/null || "$(dirname "$0")/install-just.sh"
"$(dirname "$0")/setup-llmlint.sh"
