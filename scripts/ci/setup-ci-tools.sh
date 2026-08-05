#!/usr/bin/env bash
# llmlint: ignore-file[changed_behavior_has_e2e] This CI/developer installer has no browser interface; its checksum and executable verification paths exercise the real downloaded tools.
set -euo pipefail
mode="${1:-}"
[[ $# -le 1 && ("$mode" == "" || "$mode" == "--verify" || "$mode" == "--plan") ]] || {
  echo "setup-ci-tools: unsupported arguments; usage: setup-ci-tools.sh [--verify|--plan]" >&2
  exit 2
}
tool_root="$(pwd)/.tools"
tool_bin="$tool_root/bin"
# Reviewed platform contract. Each supported host maps to the upstream archive
# tokens for its architecture: actionlint publishes Go's amd64/arm64 spelling
# while shellcheck publishes x86_64/aarch64, and both ship every supported
# Linux architecture as .tar.gz, so no extra decompressor is required.
case "$(uname -s) $(uname -m)" in
  "Linux x86_64") platform="x86_64" actionlint_arch="amd64" shellcheck_arch="x86_64" ;;
  "Linux aarch64" | "Linux arm64") platform="aarch64" actionlint_arch="arm64" shellcheck_arch="aarch64" ;;
  *) platform="" actionlint_arch="" shellcheck_arch="" ;;
esac
read_contract() {
  node -e '
    const contract = require("./ci-tools.json");
    const keys = ["schema", "actionlint", "shellcheck", "codex"];
    if (!contract || Object.keys(contract).length !== keys.length || !keys.every((key) => Object.hasOwn(contract, key)) || contract.schema !== 3) throw new Error("invalid CI tool contract; restore ci-tools.json schema 3 with exactly the actionlint, shellcheck, and codex pins");
    const platforms = ["x86_64", "aarch64"];
    for (const name of ["actionlint", "shellcheck"]) {
      const tool = contract[name];
      if (!tool || Object.keys(tool).length !== 2 || !/^\d+\.\d+\.\d+$/.test(tool.version)) throw new Error("invalid " + name + " contract");
      const digests = tool.sha256;
      if (!digests || Object.keys(digests).length !== platforms.length || !platforms.every((key) => /^[0-9a-f]{64}$/.test(digests[key]))) throw new Error("invalid " + name + " contract; pin a sha256 for exactly these platforms: " + platforms.join(", "));
    }
    const codex = contract.codex;
    if (!codex || Object.keys(codex).length !== 3 || codex.package !== "@openai/codex" || !/^\d+\.\d+\.\d+$/.test(codex.version) || !/^sha512-[A-Za-z0-9+/]+={0,2}$/.test(codex.integrity)) throw new Error("invalid codex contract; update ci-tools.json with the exact @openai/codex npm version and sha512 integrity");
    const platform = process.argv[1];
    process.stdout.write([contract.actionlint.version, contract.shellcheck.version, contract.actionlint.sha256[platform] ?? "", contract.shellcheck.sha256[platform] ?? ""].join("\n"));
  ' "$platform"
}
contract_report=$(read_contract) || {
  echo "setup-ci-tools: ci-tools.json failed contract validation; restore the pinned tool contract reported above, then rerun just bootstrap" >&2
  exit 1
}
mapfile -t contract <<<"$contract_report"
actionlint_version="${contract[0]:-}"
shellcheck_version="${contract[1]:-}"
actionlint_sha="${contract[2]:-}"
shellcheck_sha="${contract[3]:-}"
verify_tools() {
  [[ -x "$tool_bin/actionlint" && -x "$tool_bin/shellcheck" ]] || return 1
  actionlint_report=$("$tool_bin/actionlint" -version)
  [[ "${actionlint_report%%$'\n'*}" == "$actionlint_version" ]] || return 1
  "$tool_bin/shellcheck" --version | grep -Fx "version: $shellcheck_version" >/dev/null
}
if [[ "$mode" == "--verify" ]]; then
  verify_tools || { echo "setup-ci-tools: pinned actionlint and shellcheck are not provisioned; run just bootstrap" >&2; exit 1; }
  printf 'actionlint %s, shellcheck %s\n' "$actionlint_version" "$shellcheck_version"
  exit 0
fi
[[ -n "$platform" ]] || {
  echo "setup-ci-tools: pinned binaries support Linux x86_64 and Linux aarch64; use the repository CI container or add a reviewed platform contract" >&2
  exit 2
}
actionlint_archive="actionlint_${actionlint_version}_linux_${actionlint_arch}.tar.gz"
actionlint_url="https://github.com/rhysd/actionlint/releases/download/v${actionlint_version}/${actionlint_archive}"
shellcheck_archive="shellcheck-v${shellcheck_version}.linux.${shellcheck_arch}.tar.gz"
shellcheck_url="https://github.com/koalaman/shellcheck/releases/download/v${shellcheck_version}/${shellcheck_archive}"
# The archives and digests this host would install, so the reviewed platform
# contract is observable without downloading anything.
if [[ "$mode" == "--plan" ]]; then
  # llmlint: ignore[tool_output_is_signal] This report mode exists only to emit the resolved platform contract; each line is a distinct pinned artifact, so the report is the signal rather than progress narration.
  printf 'platform %s\nactionlint %s %s\nshellcheck %s %s\n' "$platform" "$actionlint_url" "$actionlint_sha" "$shellcheck_url" "$shellcheck_sha"
  exit 0
fi
if verify_tools; then exit 0; fi
provisioning_failed() {
  local setup_status=$?
  echo "setup-ci-tools: provisioning command failed; verify network access and the pinned archive utilities, then rerun just bootstrap" >&2
  exit "$setup_status"
}
trap provisioning_failed ERR
mkdir -p "$tool_bin"
setup_tmp=$(mktemp -d)
trap 'rm -rf "$setup_tmp"' EXIT
curl -fsSL "$actionlint_url" -o "$setup_tmp/$actionlint_archive"
printf '%s  %s\n' "$actionlint_sha" "$setup_tmp/$actionlint_archive" | sha256sum --check --status || {
  echo "setup-ci-tools: actionlint archive checksum mismatch; verify ci-tools.json against the upstream release" >&2
  exit 1
}
tar -xzf "$setup_tmp/$actionlint_archive" -C "$setup_tmp" actionlint
install -m 0755 "$setup_tmp/actionlint" "$tool_bin/actionlint"
curl -fsSL "$shellcheck_url" -o "$setup_tmp/$shellcheck_archive"
printf '%s  %s\n' "$shellcheck_sha" "$setup_tmp/$shellcheck_archive" | sha256sum --check --status || {
  echo "setup-ci-tools: shellcheck archive checksum mismatch; verify ci-tools.json against the upstream release" >&2
  exit 1
}
tar -xzf "$setup_tmp/$shellcheck_archive" -C "$setup_tmp"
install -m 0755 "$setup_tmp/shellcheck-v${shellcheck_version}/shellcheck" "$tool_bin/shellcheck"
verify_tools || { echo "setup-ci-tools: installed tools did not report the pinned versions; remove .tools and rerun just bootstrap" >&2; exit 1; }
