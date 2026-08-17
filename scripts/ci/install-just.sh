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
# GITHUB_TOKEN is ambient environment input as well, and it is spent below as an
# HTTP header value, so constrain it here beside the destination: a carriage
# return or newline in it would end the Authorization header and have whatever
# followed read as another one. A GitHub token carries none of those characters.
github_token="${GITHUB_TOKEN:-}"
[[ -z "$github_token" || "$github_token" =~ ^[A-Za-z0-9_.-]+$ ]] || { echo "install-just: GITHUB_TOKEN must be a GitHub token — letters, digits, '_', '.', or '-' only; correct or unset it, then retry" >&2; exit 2; }
readonly github_token
readonly installer_sha256="a87d0419dab916fca62627809b3e6e0dd175fcd9c7f91275c655d5978c86ee6f"
resolve_tag="$(dirname -- "${BASH_SOURCE[0]}")/resolve-just-tag.sh"
readonly resolve_tag
readonly latest_release="https://api.github.com/repos/casey/just/releases/latest"
installer="$(mktemp)" || { echo "install-just: could not create a temporary installer file; check temporary-directory permissions and retry" >&2; exit 1; }
trap 'rm -f -- "$installer" ${release+"$release"}' EXIT
release="$(mktemp)" || { echo "install-just: could not create a temporary release-document file; check temporary-directory permissions and retry" >&2; exit 1; }
mkdir -p "$bin_dir" || { echo "install-just: could not create $bin_dir; set XDG_BIN_HOME to a writable directory and retry" >&2; exit 1; }
curl --proto '=https' --tlsv1.2 -fsSL -o "$installer" https://just.systems/install.sh || { echo "install-just: could not download the pinned installer from just.systems; check network access and retry" >&2; exit 1; }
actual_sha256="$(sha256sum "$installer" | cut -d ' ' -f 1)"
[[ "$actual_sha256" == "$installer_sha256" ]] || { echo "install-just: installer checksum mismatch; verify just.systems has not changed unexpectedly before updating the reviewed digest" >&2; exit 1; }
# Left to itself the verified installer resolves the latest tag with a
# line-oriented parse, which reads the wrong field whenever the release document
# arrives on one line. Resolve the tag by name here and pass it explicitly, so
# the installed version never depends on how the response was serialized.
# GITHUB_TOKEN is forwarded when the caller set one, because this request now
# spends the API budget the installer used to spend on the caller's behalf.
api_auth=()
if [[ -n "$github_token" ]]; then api_auth=(--header "Authorization: Bearer $github_token"); fi
curl --proto '=https' --tlsv1.2 -fsSL ${api_auth[@]+"${api_auth[@]}"} -o "$release" "$latest_release" || { echo "install-just: could not read the latest just release from GitHub; check network access and retry" >&2; exit 1; }
tag="$("$resolve_tag" "$latest_release" <"$release")" || exit 1
# The verified installer narrates every step it takes, and none of that is
# something a caller acts on once it has succeeded. Hold the narration until it
# is a diagnosis — report it with the failure it explains — and answer a
# successful run with the one fact the caller asked for: the version now
# installed, and where.
install_output="$(bash "$installer" --tag "$tag" --to "$bin_dir" 2>&1)" || { printf '%s\n' "$install_output" >&2; echo "install-just: verified installer failed; check $bin_dir permissions and retry" >&2; exit 1; }
printf 'install-just: installed just %s into %s\n' "$tag" "$bin_dir"
