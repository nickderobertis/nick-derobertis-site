#!/usr/bin/env bash
# llmlint: ignore-file[changed_behavior_has_e2e] This developer bootstrap has no browser interface; ci-tools-contract.spec.ts drives its real download, integrity, installation, and failure diagnostics as a subprocess.
set -euo pipefail
# XDG_BIN_HOME and HOME are ambient environment input, and this is the only
# place the install destination is decided, so constrain it here — before a
# directory is created and an executable is written into it. A relative
# destination would land wherever the caller happened to be, and a '..' segment
# would climb out of the directory the caller named.
bin_dir="${XDG_BIN_HOME:-${HOME:-}/.local/bin}"
[[ "$bin_dir" == /* && "$bin_dir" != *"/.."* ]] || { echo "install-just: the install destination must be an absolute path with no '..' segment; received '$bin_dir'. Set XDG_BIN_HOME to a writable absolute directory and retry" >&2; exit 2; }
readonly bin_dir
readonly installer_sha256="a87d0419dab916fca62627809b3e6e0dd175fcd9c7f91275c655d5978c86ee6f"
installer="$(mktemp)" || { echo "install-just: could not create a temporary installer file; check temporary-directory permissions and retry" >&2; exit 1; }
trap 'rm -f "$installer"' EXIT
mkdir -p "$bin_dir" || { echo "install-just: could not create $bin_dir; set XDG_BIN_HOME to a writable directory and retry" >&2; exit 1; }
curl --proto '=https' --tlsv1.2 -fsSL -o "$installer" https://just.systems/install.sh || { echo "install-just: could not download the pinned installer from just.systems; check network access and retry" >&2; exit 1; }
actual_sha256="$(sha256sum "$installer" | cut -d ' ' -f 1)"
[[ "$actual_sha256" == "$installer_sha256" ]] || { echo "install-just: installer checksum mismatch; verify just.systems has not changed unexpectedly before updating the reviewed digest" >&2; exit 1; }
bash "$installer" --to "$bin_dir" >/dev/null || { echo "install-just: verified installer failed; check $bin_dir permissions and retry" >&2; exit 1; }
