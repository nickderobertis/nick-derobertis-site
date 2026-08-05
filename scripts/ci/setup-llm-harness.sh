#!/usr/bin/env bash
# llmlint: ignore-file[changed_behavior_has_e2e] This CI/developer installer has no browser interface; it exercises the real npm registry, verifies package integrity, and validates the installed CLI executable.
set -euo pipefail

mode="install"
case "$#" in
  0) ;;
  1)
    [[ "$1" == "--verify" ]] || {
      echo "setup-llm-harness: unknown argument '$1'; use no arguments to install or --verify to check the installed CLI" >&2
      exit 2
    }
    mode="verify"
    ;;
  *)
    echo "setup-llm-harness: expected no arguments or exactly --verify" >&2
    exit 2
    ;;
esac

if ! contract_output=$(
  node -e '
    const contract = require("./ci-tools.json");
    if (!contract || typeof contract !== "object" || Array.isArray(contract))
      throw new Error("invalid CI tool contract root; ci-tools.json must contain an object");
    const { codex } = contract;
    if (
      !codex ||
      Object.keys(codex).length !== 3 ||
      codex.package !== "@openai/codex" ||
      !/^\d+\.\d+\.\d+$/.test(codex.version) ||
      !/^sha512-[A-Za-z0-9+/]+={0,2}$/.test(codex.integrity)
    ) throw new Error("invalid codex CI tool contract; update ci-tools.json with the exact @openai/codex npm version and sha512 integrity");
    process.stdout.write([codex.package, codex.version, codex.integrity].join("\n"));
  '
); then
  echo "setup-llm-harness: could not read the Codex tool contract; correct ci-tools.json and rerun just setup-llm-harness" >&2
  exit 1
fi
mapfile -t contract <<<"$contract_output"
package_name="${contract[0]:-}"
version="${contract[1]:-}"
expected_integrity="${contract[2]:-}"

if [[ "$mode" == "verify" ]]; then
  command -v codex >/dev/null || {
    echo "setup-llm-harness: codex is not installed; run just setup-llm-harness" >&2
    exit 1
  }
  if ! report=$(codex --version); then
    echo "setup-llm-harness: codex could not execute; remove the broken installation and rerun just setup-llm-harness" >&2
    exit 1
  fi
  [[ "$report" == "codex-cli $version" ]] || {
    echo "setup-llm-harness: codex reported '$report', expected 'codex-cli $version'; rerun just setup-llm-harness" >&2
    exit 1
  }
  printf 'codex-cli %s\n' "$version"
  exit 0
fi

setup_tmp=$(mktemp -d)
trap 'rm -rf "$setup_tmp"' EXIT
pack_report="$setup_tmp/pack.json"
npm pack --json --pack-destination "$setup_tmp" "${package_name}@${version}" >"$pack_report" || {
  echo "setup-llm-harness: npm could not download ${package_name}@${version}; check registry access and rerun just setup-llm-harness" >&2
  exit 1
}
if ! mapfile -t packed < <(
  node -e '
    const fs = require("node:fs");
    const path = require("node:path");
    const report = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    if (
      !Array.isArray(report) ||
      report.length !== 1 ||
      typeof report[0]?.filename !== "string" ||
      path.basename(report[0].filename) !== report[0].filename ||
      !/^[A-Za-z0-9._-]+\.tgz$/.test(report[0].filename) ||
      typeof report[0]?.integrity !== "string"
    ) throw new Error("invalid npm pack report");
    process.stdout.write([report[0].filename, report[0].integrity].join("\n"));
  ' "$pack_report"
); then
  echo "setup-llm-harness: npm returned an invalid pack report; verify npm registry access and rerun just setup-llm-harness" >&2
  exit 1
fi
archive="${packed[0]:-}"
actual_integrity="${packed[1]:-}"
[[ "$actual_integrity" == "$expected_integrity" ]] || {
  echo "setup-llm-harness: npm integrity mismatch for ${package_name}@${version}; verify ci-tools.json against the registry release" >&2
  exit 1
}
install_log="$setup_tmp/install.log"
npm install --global "$setup_tmp/$archive" >"$install_log" 2>&1 || {
  cat "$install_log" >&2
  echo "setup-llm-harness: npm could not install the verified Codex package; check global npm permissions and rerun just setup-llm-harness" >&2
  exit 1
}
"$0" --verify
