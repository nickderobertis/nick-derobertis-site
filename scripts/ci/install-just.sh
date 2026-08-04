#!/usr/bin/env bash
set -euo pipefail
bin_dir="${XDG_BIN_HOME:-${HOME}/.local/bin}"
mkdir -p "$bin_dir"
curl --proto '=https' --tlsv1.2 -sSf https://just.systems/install.sh | bash -s -- --to "$bin_dir" >/dev/null
