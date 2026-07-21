#!/usr/bin/env bash
set -euo pipefail
tool_root="$(pwd)/.tools"
tool_bin="$tool_root/bin"
read_contract() {
  node -e '
    const contract = require("./ci-tools.json");
    const keys = ["schema", "actionlint", "shellcheck"];
    if (!contract || Object.keys(contract).length !== keys.length || !keys.every((key) => Object.hasOwn(contract, key)) || contract.schema !== 1) throw new Error("invalid CI tool contract");
    for (const name of ["actionlint", "shellcheck"]) {
      const tool = contract[name];
      if (!tool || Object.keys(tool).length !== 2 || !/^\d+\.\d+\.\d+$/.test(tool.version) || !/^[0-9a-f]{64}$/.test(tool.sha256)) throw new Error("invalid " + name + " contract");
    }
    process.stdout.write([contract.actionlint.version, contract.actionlint.sha256, contract.shellcheck.version, contract.shellcheck.sha256].join("\n"));
  '
}
mapfile -t contract < <(read_contract)
actionlint_version="${contract[0]:-}"
actionlint_sha="${contract[1]:-}"
shellcheck_version="${contract[2]:-}"
shellcheck_sha="${contract[3]:-}"
verify_tools() {
  [[ -x "$tool_bin/actionlint" && -x "$tool_bin/shellcheck" ]] || return 1
  actionlint_report=$("$tool_bin/actionlint" -version)
  [[ "${actionlint_report%%$'\n'*}" == "$actionlint_version" ]] || return 1
  "$tool_bin/shellcheck" --version | grep -Fx "version: $shellcheck_version" >/dev/null
}
if [[ "${1:-}" == "--verify" ]]; then
  verify_tools || { echo "setup-ci-tools: pinned actionlint and shellcheck are not provisioned; run just bootstrap" >&2; exit 1; }
  printf 'actionlint %s\nshellcheck %s\n' "$actionlint_version" "$shellcheck_version"
  exit 0
fi
[[ "$(uname -s)" == "Linux" && "$(uname -m)" == "x86_64" ]] || {
  echo "setup-ci-tools: pinned binaries support Linux x86_64; use the repository CI container or add a reviewed platform contract" >&2
  exit 2
}
if verify_tools; then exit 0; fi
mkdir -p "$tool_bin"
setup_tmp=$(mktemp -d)
trap 'rm -rf "$setup_tmp"' EXIT
actionlint_archive="actionlint_${actionlint_version}_linux_amd64.tar.gz"
curl -fsSL "https://github.com/rhysd/actionlint/releases/download/v${actionlint_version}/${actionlint_archive}" -o "$setup_tmp/$actionlint_archive"
printf '%s  %s\n' "$actionlint_sha" "$setup_tmp/$actionlint_archive" | sha256sum --check --status || {
  echo "setup-ci-tools: actionlint archive checksum mismatch; verify ci-tools.json against the upstream release" >&2
  exit 1
}
tar -xzf "$setup_tmp/$actionlint_archive" -C "$setup_tmp" actionlint
install -m 0755 "$setup_tmp/actionlint" "$tool_bin/actionlint"
shellcheck_archive="shellcheck-v${shellcheck_version}.linux.x86_64.tar.xz"
curl -fsSL "https://github.com/koalaman/shellcheck/releases/download/v${shellcheck_version}/${shellcheck_archive}" -o "$setup_tmp/$shellcheck_archive"
printf '%s  %s\n' "$shellcheck_sha" "$setup_tmp/$shellcheck_archive" | sha256sum --check --status || {
  echo "setup-ci-tools: shellcheck archive checksum mismatch; verify ci-tools.json against the upstream release" >&2
  exit 1
}
tar -xJf "$setup_tmp/$shellcheck_archive" -C "$setup_tmp"
install -m 0755 "$setup_tmp/shellcheck-v${shellcheck_version}/shellcheck" "$tool_bin/shellcheck"
verify_tools || { echo "setup-ci-tools: installed tools did not report the pinned versions; remove .tools and rerun just bootstrap" >&2; exit 1; }
