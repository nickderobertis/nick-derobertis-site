#!/usr/bin/env bash
# Throwaway bun spike: re-runs every stage of the spike in order and prints each
# stage's name, exit status and PASS/FAIL. Usage: spike-bun/run-stages.sh [first-stage]
# Logs go to $SPIKE_OUT (default: a temp dir). Stage 6 replays the capture job of
# screencomp v0.4.8's published visual-docs-reusable.yml in its container.
set -uo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd); cd "$ROOT"
OUT=${SPIKE_OUT:-$(mktemp -d)}; mkdir -p "$OUT"; FIRST=${1:-1}
export NX_NO_CLOUD=true NX_DAEMON=false CI=1
BUN_VERSION=$(sed -n 's/^bun //p' .tool-versions)
command -v bun >/dev/null && [ "$(bun --version)" = "$BUN_VERSION" ] || { mkdir -p "$OUT/bun"; npm install --prefix "$OUT/bun" "bun@$BUN_VERSION" >/dev/null 2>&1; export PATH="$OUT/bun/node_modules/.bin:$PATH"; }
IMAGE=$(python3 -c 'import re;print(re.search(r"container: (\S+)",open(".github/workflows/visual-docs.yml").read()).group(1))')
CAPTURE=$(python3 -c 'import yaml;print(yaml.safe_load(open(".github/workflows/visual-docs.yml"))["jobs"]["visual-docs"]["with"]["capture-command"])')
APP=${SPIKE_APP:-bio}
declare -a SUMMARY
stage() { local n=$1 name=$2; shift 2; [ "$n" -lt "$FIRST" ] && return 0
  echo "=== stage $n: $name"; ( "$@" ) >"$OUT/stage$n.log" 2>&1; local rc=$?
  tail -n 25 "$OUT/stage$n.log"; local v=PASS; [ $rc -eq 0 ] || v=FAIL
  SUMMARY+=("stage $n | $name | exit $rc | $v"); echo "=== stage $n: $name -> exit $rc $v"; }

s1() { d="$OUT/clone"; rm -rf "$d"; git clone -q --branch "$(git rev-parse --abbrev-ref HEAD)" "file://$ROOT" "$d" && cd "$d" && bun install --frozen-lockfile; }
s2() { bun x nx run-many -t build --parallel=3 --skip-nx-cache; }
s3() { bun x nx run shell:e2e --skip-nx-cache && bun x nx run-many -t e2e --exclude=shell --parallel=1 --skip-nx-cache; }
s4() { bun x nx run-many -t test --parallel=3 --skip-nx-cache; }
s5() { just prerender && echo "just prerender: shell:prerender (build + artifact validation) succeeded"; }
s6() { set -e; ws="$OUT/capture-ws"; rm -rf "$ws"
  # affected job, under bun: its Compute affected visual projects step, then the app matrix entry.
  bun x nx show projects --affected --with-target screenshot --base=HEAD~1 --head=HEAD --json
  entry=$(printf '["%s"]' "$APP" | node scripts/visual/affected-visual-projects.mjs); echo "matrix: $entry"
  cur=$(node -e 'console.log(JSON.parse(process.argv[1])[0].current)' "$entry"); ver=$(node -e 'console.log(JSON.parse(process.argv[1])[0].verify)' "$entry")
  # capture job, container: $IMAGE. step: uses: actions/checkout@v4 (clean checkout of HEAD)
  git clone -q "file://$ROOT" "$ws" && git -C "$ws" checkout -q "$(git rev-parse HEAD)"
  printf '%s\n' "$CAPTURE" >"$OUT/capture-command.sh"; cp "$OUT/capture-command.sh" "$ws/.capture-command.sh"
  run() { docker run --rm --ipc=host -v "$ws":/__w/repo -w /__w/repo -e CI=true -e GITHUB_ACTIONS=true -e GITHUB_SHA="$(git rev-parse HEAD)" -e NX_NO_CLOUD=true -e SCREENCOMP_PROJECT="$APP" -e SHOTS_OUT="$1" "$IMAGE" sh -e .capture-command.sh; }
  echo "--- step: Log runner CPU"; grep -E -m1 'model name' /proc/cpuinfo || true
  echo "--- step: Capture screenshots (run: \${{ inputs.capture-command }}, SHOTS_OUT=$cur/x86_64)"; run "$cur/x86_64"
  echo "--- step: Capture again for the reproducibility gate (SHOTS_OUT=$ver/x86_64)"; run "$ver/x86_64"
  docker run --rm -v "$ws":/w "$IMAGE" chown -R "$(id -u):$(id -g)" /w
  # report job: uses: nickderobertis/screencomp@v0 with version v0.4.8, then visual-docs@v0 "Verify capture is reproducible"
  sc="$OUT/screencomp"; mkdir -p "$sc"; curl -fsSL https://raw.githubusercontent.com/nickderobertis/screencomp/v0.4.8/scripts/install.sh | sh -s -- --version v0.4.8 --to "$sc" >/dev/null; "$sc/screencomp" --version
  cd "$ws"; echo "--- step: Verify capture is reproducible: screencomp verify --first $cur --second $ver --arch x86_64"; "$sc/screencomp" verify --first "$cur" --second "$ver" --arch x86_64; }
s7() { python3 ~/.claude/skills/create-repo/scripts/check_repo_baseline.py "$ROOT"; }

stage 1 "bun install --frozen-lockfile on a clean clone" s1
stage 2 "nx run-many -t build" s2
stage 3 "Module Federation in a real browser (shell:e2e host-composed + each remote's e2e standalone)" s3
stage 4 "every project's test target with coverage at the 95% floor" s4
stage 5 "just prerender + artifact validation" s5
stage 6 "screencomp v0.4.8 reusable workflow capture x2 + reproducibility gate ($APP)" s6
stage 7 "create-repo check_repo_baseline.py (deterministic tier)" s7
echo; echo "=== summary (logs: $OUT)"; printf '%s\n' "${SUMMARY[@]}"
