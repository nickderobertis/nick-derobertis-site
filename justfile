set shell := ["bash", "-euo", "pipefail", "-c"]
set positional-arguments := true

# These scripts import workspace libraries' TypeScript, which Node type-strips.
# package.json declares no module type, so Node warns once per run about
# reparsing them. Drop that one warning rather than silencing all of them.
node_typestrip := "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON"

# Keep Nx's content-addressed cache across disposable git worktrees. Callers can
# override this when they need an isolated cache.
# llmlint: ignore[boundary_inputs_validated] just passes this path as one environment value to Nx; it is never interpolated into a shell command, and Nx owns directory-path validation.
export NX_CACHE_DIRECTORY := env_var_or_default("NX_CACHE_DIRECTORY", env_var_or_default("XDG_CACHE_HOME", env_var("HOME") + "/.cache") + "/nx/nick-derobertis-site")

# Bun is explicitly ruled out: Nx's rspack Module Federation executor supports
# this workspace through pnpm's linker. pnpm is the documented fallback in
# AGENTS.md and the composed Stack-and-composition record.
bootstrap:
    if ! command -v pnpm >/dev/null; then pnpm_bin_dir="${XDG_BIN_HOME:-$HOME/.local/bin}"; mkdir -p "$pnpm_bin_dir"; corepack enable --install-directory "$pnpm_bin_dir" || { echo "bootstrap: pnpm is unavailable and Corepack could not install a user-scoped shim; verify the Node installation and writable XDG_BIN_HOME, then rerun just bootstrap" >&2; exit 1; }; export PATH="$pnpm_bin_dir:$PATH"; fi
    log=$(mktemp); trap 'rm -f "$log"' EXIT; pnpm install --frozen-lockfile --reporter=silent >"$log" 2>&1 || { cat "$log" >&2; echo "bootstrap: dependency install failed; check the lockfile and registry access, then rerun just bootstrap" >&2; exit 1; }
    scripts/ci/setup-ci-tools.sh || { echo "bootstrap: pinned CI tool installation failed; check the reported checksum or network error, then rerun just bootstrap" >&2; exit 1; }
    log=$(mktemp); trap 'rm -f "$log"' EXIT; pnpm exec playwright install chromium >"$log" 2>&1 || { cat "$log" >&2; echo "bootstrap: Chromium install failed; check Playwright system requirements, then rerun just bootstrap" >&2; exit 1; }
    # llmlint: ignore[changed_behavior_has_e2e] Bootstrap is a developer CLI with no browser interface; this path verifies the installer bytes and propagates download, integrity, and installation failures directly.
    if ! command -v screencomp >/dev/null; then installer=$(mktemp); log=$(mktemp); trap 'rm -f "$installer" "$log"' EXIT; curl -fsSL -o "$installer" https://raw.githubusercontent.com/nickderobertis/screencomp/59c45975126574f60d148b3ef3c9c5f8cef24987/scripts/install.sh 2>"$log" || { cat "$log" >&2; echo "bootstrap: screencomp installer download failed; check network access and rerun just bootstrap" >&2; exit 1; }; actual=$(node -e 'const fs = require("node:fs"); const crypto = require("node:crypto"); process.stdout.write(crypto.createHash("sha256").update(fs.readFileSync(process.argv[1])).digest("hex"));' "$installer"); [[ "$actual" = dd4e02daf93c3f056b84b0555c03c60b8e8bfb29ecb462e7dfa4b84fd84202b4 ]] || { echo "bootstrap: screencomp installer checksum mismatch; verify GitHub repository access and rerun just bootstrap" >&2; exit 1; }; sh "$installer" --version v0.4.5 >"$log" 2>&1 || { cat "$log" >&2; echo "bootstrap: screencomp install failed; check network access and rerun just bootstrap" >&2; exit 1; }; fi

bootstrap-ci:
    log=$(mktemp); trap 'rm -f "$log"' EXIT; pnpm install --frozen-lockfile --reporter=silent >"$log" 2>&1 || { cat "$log" >&2; echo "bootstrap-ci: dependency install failed; check the lockfile and registry access, then rerun just bootstrap-ci" >&2; exit 1; }
    scripts/ci/setup-ci-tools.sh || { echo "bootstrap-ci: pinned CI tool installation failed; check the reported checksum or network error, then rerun just bootstrap-ci" >&2; exit 1; }

lint-workflows:
    scripts/ci/setup-ci-tools.sh --verify >/dev/null
    .tools/bin/actionlint .github/workflows/*.yml || { echo "lint-workflows: GitHub workflow validation failed; fix the actionlint findings above, then rerun just lint-workflows" >&2; exit 1; }
    .tools/bin/shellcheck scripts/ci/*.sh .githooks/pre-push || { echo "lint-workflows: shell validation failed; fix the shellcheck findings above, then rerun just lint-workflows" >&2; exit 1; }
    # screencomp runs its injected capture callback with the container's /bin/sh,
    # and actionlint only shellchecks literal run: blocks, so check them as POSIX sh here.
    callbacks=$(mktemp -d); trap 'rm -rf "$callbacks"' EXIT; node scripts/visual/extract-injected-callbacks.mjs "$callbacks" >/dev/null && .tools/bin/shellcheck --shell=sh "$callbacks"/*.sh || { echo "lint-workflows: screencomp's injected capture callback is not valid POSIX sh; rewrite it without bash-only constructs, then rerun just lint-workflows" >&2; exit 1; }
    # Each verifier reports the contract it enforced, but a clean gate has to stay
    # quiet, so the two contract reports a reader needs are collected into this
    # recipe's single status line and the rest is dropped. Every verifier writes
    # its diagnostics to stderr, so nothing is hidden on failure.
    node scripts/visual/verify-visual-contract.mjs >/dev/null || { echo "lint-workflows: visual tool pins or capture contracts drifted; update visual-tools.json and every named consumer together" >&2; exit 1; }
    node scripts/visual/verify-reference-migration.mjs >/dev/null || { echo "lint-workflows: PR #12 reference migration verification failed; repair the migration map or its owned baselines and retry" >&2; exit 1; }
    @# llmlint: ignore[changed_behavior_has_e2e] These gates read committed configuration and have no browser interface: they fail a push before any workflow runs, so nothing they reject can reach a visitor. runtime-pins.spec.ts and content-store-contract.spec.ts drive this exact command as a real subprocess over the committed tree and over copies with one pin or one restatement moved.
    @pins=$(node scripts/ci/verify-runtime-pins.mjs) || { echo "lint-workflows: workflow runtime pins drifted; align every workflow with package.json's packageManager and one Node version, then rerun just lint-workflows" >&2; exit 1; }; names=$({{node_typestrip}} scripts/publish/verify-content-store-contract.mjs) || { echo "lint-workflows: the content-store branch, checkout, or workdir names drifted; align every restatement with libs/build-config/src/publish-fragment.ts, then rerun just lint-workflows" >&2; exit 1; }; echo "lint-workflows: $pins; $names"

check: test lint-workflows
    # CI=1 is the supported warnings-as-errors contract for the Nx compiler,
    # bundler, prerender, Playwright, and screenshot executors in this workspace.
    # llmlint: ignore[changed_behavior_has_e2e] This developer/CI command has no browser interface; it dispatches the real Playwright e2e and screenshot targets, whose user journeys and failure paths own browser coverage.
    base="${NX_BASE:-HEAD~1}"; head="${NX_HEAD:-HEAD}"; git rev-parse --verify "$base^{commit}" >/dev/null && git rev-parse --verify "$head^{commit}" >/dev/null || { echo "check: NX_BASE and NX_HEAD must resolve to commits" >&2; exit 2; }; log=$(mktemp); trap 'rm -f "$log"' EXIT; pnpm exec biome check --error-on-warnings . >"$log" 2>&1 && CI=1 pnpm exec nx affected -t lint --base="$base" --head="$head" --parallel=3 --args="--error-on-warnings" >>"$log" 2>&1 && CI=1 pnpm exec nx affected -t typecheck,test,build,prerender --base="$base" --head="$head" --parallel=3 >>"$log" 2>&1 && CI=1 pnpm exec nx affected -t e2e,screenshot --base="$base" --head="$head" --parallel=3 --skip-nx-cache >>"$log" 2>&1 && CI=1 pnpm exec nx run shell:e2e --skip-nx-cache >>"$log" 2>&1 || { cat "$log" >&2; echo "check: quality gate failed; fix warnings and errors above, then rerun just check" >&2; exit 1; }

# Canonical full pre-push gate used by orchestration and contributors.
# llmlint: ignore[changed_behavior_has_e2e] This command-only alias has no browser interface and delegates unchanged to check, whose dispatched Playwright targets own real-browser coverage.
gate: check

# CI runs this non-PR safety sweep so affected detection is never the only gate.
check-all: lint-workflows
    # Keep the same CI warnings-as-errors contract during the non-affected sweep.
    # llmlint: ignore[changed_behavior_has_e2e] This CI command has no browser interface; it dispatches the real Playwright e2e and screenshot targets for every project and propagates their exit status.
    log=$(mktemp); trap 'rm -f "$log"' EXIT; pnpm exec biome check --error-on-warnings . >"$log" 2>&1 && CI=1 pnpm exec nx run-many -t lint --all --parallel=3 --args="--error-on-warnings" >>"$log" 2>&1 && CI=1 pnpm exec nx run-many -t typecheck,test,build,prerender --all --parallel=3 >>"$log" 2>&1 && CI=1 pnpm exec nx run-many -t e2e,screenshot --all --parallel=3 --skip-nx-cache >>"$log" 2>&1 && CI=1 pnpm exec nx run shell:e2e --skip-nx-cache >>"$log" 2>&1 || { cat "$log" >&2; echo "check-all: quality gate failed; fix warnings and errors above, then rerun just check-all" >&2; exit 1; }

test:
    base="${NX_BASE:-HEAD~1}"; head="${NX_HEAD:-HEAD}"; git rev-parse --verify "$base^{commit}" >/dev/null && git rev-parse --verify "$head^{commit}" >/dev/null || { echo "test: NX_BASE and NX_HEAD must resolve to commits" >&2; exit 2; }; log=$(mktemp); trap 'rm -f "$log"' EXIT; pnpm exec nx affected -t test,e2e --base="$base" --head="$head" --parallel=3 >"$log" 2>&1 || { cat "$log" >&2; echo "test: browser or unit tests failed; fix the findings above and rerun just test" >&2; exit 1; }

lint:
    log=$(mktemp); trap 'rm -f "$log"' EXIT; pnpm exec nx run-many -t lint --all --args="--error-on-warnings" >"$log" 2>&1 && pnpm exec nx run-many -t typecheck --all >>"$log" 2>&1 || { cat "$log" >&2; echo "lint: lint or typecheck failed; fix the findings above and rerun just lint" >&2; exit 1; }

format:
    pnpm exec biome check --write . || { echo "format: Biome could not format the workspace; fix its reported configuration or syntax error, then rerun just format" >&2; exit 1; }

upgrade:
    log=$(mktemp); trap 'rm -f "$log"' EXIT; pnpm update --latest --recursive >"$log" 2>&1 || { cat "$log" >&2; echo "upgrade: dependency update failed; resolve the reported registry or dependency conflict, then rerun just upgrade" >&2; exit 1; }
    just check

test-e2e:
    log=$(mktemp); trap 'rm -f "$log"' EXIT; pnpm exec nx run shell:e2e >"$log" 2>&1 || { cat "$log" >&2; echo "test-e2e: browser integration failed; fix the failing journey above and rerun just test-e2e" >&2; exit 1; }

prerender:
    log=$(mktemp); trap 'rm -f "$log"' EXIT; pnpm exec nx run shell:prerender >"$log" 2>&1 || { cat "$log" >&2; echo "prerender: static Pages artifact failed; fix the build or artifact validation above and rerun just prerender" >&2; exit 1; }

# Print the publish-lane matrix for a push range, or every lane when no range
# is given. The Pages workflow's affected job is the only caller.
@publish-lanes base="" head="":
    # llmlint: ignore[changed_behavior_has_e2e] This selection command has no browser interface; publish-lanes.spec.ts drives the real CLI it delegates to through affected selection, the seed-everything path, and invalid input.
    base="$1"; head="$2"; if [[ -z "$base" ]]; then {{node_typestrip}} scripts/publish/publishable-apps.mjs --all; else [[ "$base" != -* && "$head" != -* ]] && git rev-parse --verify "$base^{commit}" >/dev/null 2>&1 && git rev-parse --verify "$head^{commit}" >/dev/null 2>&1 || { echo "publish-lanes: base and head must resolve to commits; pass the push range (for example just publish-lanes HEAD~1 HEAD after fetching it), or pass no arguments to select every lane" >&2; exit 2; }; err=$(mktemp); trap 'rm -f "$err"' EXIT; affected=$(pnpm exec nx show projects --affected --with-target build --base="$base" --head="$head" --json 2>"$err") || { cat "$err" >&2; echo "publish-lanes: Nx could not resolve the affected projects between $base and $head; fix the error above, or fetch the missing commits, then rerun just publish-lanes $base $head" >&2; exit 1; }; printf '%s' "$affected" | {{node_typestrip}} scripts/publish/publishable-apps.mjs; fi

# Build exactly one app, which is all a publish lane is allowed to build.
@build-app app:
    # llmlint: ignore[changed_behavior_has_e2e] This build command has no browser interface; it dispatches the real Nx build target whose published output every standalone and host-composed browser journey drives.
    status=0; lane=$({{node_typestrip}} scripts/publish/publishable-apps.mjs --lane "$1") || status=$?; if (( status != 0 )); then if (( status == 2 )); then echo "build-app: app must name a publish lane; the reason above lists every lane, so pass one from just publish-lanes and rerun just build-app <app>" >&2; else echo "build-app: the publish lanes could not be resolved; fix the error above and rerun just build-app <app>" >&2; fi; exit "$status"; fi; log=$(mktemp); trap 'rm -f "$log"' EXIT; CI=1 pnpm exec nx run "$lane:build" >"$log" 2>&1 || { cat "$log" >&2; echo "build-app: building $lane failed; fix the errors above and rerun just build-app $lane" >&2; exit 1; }

# Write one app's already-built bytes to its own subtree of the content-store
# branch. Every input arrives as PUBLISH_* environment values, which
# scripts/publish/publish-fragment.mjs validates before it touches git.
@publish-fragment:
    # llmlint: ignore[changed_behavior_has_e2e] This publish CLI has no browser interface; publish-fragment.spec.ts drives it against a real local bare repository, and the bytes it stores reach the browser only once the compose lane assembles them.
    {{node_typestrip}} scripts/publish/publish-fragment.mjs

# Assemble and gate the Pages artifact from bytes that are already published.
# This builds nothing: it is the compose-and-deploy lane's whole workload, and
# it is idempotent full state, so a superseded run loses no publisher's bytes.
@compose store output:
    # llmlint: ignore[changed_behavior_has_e2e] This assembly CLI has no browser interface; compose.spec.ts drives it over a fixture content store, and site.spec.ts plus every feature journey drive the artifact it emits in a real browser.
    store="$1"; output="$2"; [[ "$store" != *..* && -d "$store" ]] || { echo "compose: store must be a readable content-store apps directory; check out the content-store branch and rerun just compose <store>/apps <output>" >&2; exit 2; }; [[ "$output" != *..* && "$output" == dist/?* ]] || { echo "compose: output must be a workspace-relative build directory beneath dist/, which is the only tree compose may write into; pass one such as dist/site and rerun just compose $store <output>" >&2; exit 2; }; log=$(mktemp); trap 'rm -f "$log"' EXIT; FRAGMENT_ROOT="$store" COMPOSE_OUTPUT="$output" {{node_typestrip}} scripts/compose/compose.mjs >"$log" 2>&1 && STATIC_ARTIFACT_ROOT="$output" {{node_typestrip}} scripts/artifact/check-static-artifact.mjs >>"$log" 2>&1 || { cat "$log" >&2; echo "compose: assembling the published fragments failed; publish the app named above, then rerun just compose $store $output" >&2; exit 1; }

# Network-dependent Lighthouse comparison; intentionally excluded from `check`.
perf url="" runs="":
    @log=$(mktemp); trap 'rm -f "$log"' EXIT; PERF_URL="$1" PERF_RUNS="$2" pnpm exec nx run shell:perf >"$log" 2>&1 || { cat "$log" >&2; echo "perf: audit failed; correct the reported URL/browser issue and rerun just perf" >&2; exit 1; }; grep -m1 '^Performance comparison complete' "$log"

perf-compare new_url="" original_url="" runs="":
    @log=$(mktemp); trap 'rm -f "$log"' EXIT; PERF_URL="$1" PERF_ORIGINAL_URL="$2" PERF_RUNS="$3" pnpm exec nx run shell:perf >"$log" 2>&1 || { cat "$log" >&2; echo "perf-compare: audit failed; correct the reported URL/browser issue and rerun just perf-compare" >&2; exit 1; }; grep -m1 '^Performance comparison complete' "$log"

perf-refresh-report:
    @log=$(mktemp); trap 'rm -f "$log"' EXIT; {{node_typestrip}} scripts/perf/performance-audit.mjs --refresh-report >"$log" 2>&1 || { cat "$log" >&2; echo "perf-refresh-report: rendering the readable report failed; correct the structured findings and rerun just perf-refresh-report" >&2; exit 1; }

perf-check-report:
    @log=$(mktemp); trap 'rm -f "$log"' EXIT; {{node_typestrip}} scripts/perf/performance-audit.mjs --check-report >"$log" 2>&1 || { cat "$log" >&2; echo "perf-check-report: readable report verification failed; rerun just perf-refresh-report and commit the refreshed report" >&2; exit 1; }

# Build the complete federated artifact before serving it at the Pages base path.
serve: prerender
    {{node_typestrip}} scripts/serve/serve-e2e.mjs

e2e-affected-files file:
    # llmlint: ignore[tool_output_is_signal] This proof command intentionally preserves unedited Nx selection and execution output for docs/integration-proof.md.
    file="$1"; [[ "$file" != /* && "$file" != *..* && -f "$file" ]] || { echo "e2e-affected-files: file must be a tracked workspace-relative file" >&2; exit 2; }; pnpm exec nx show projects --affected --files="$file" --with-target=e2e --json && pnpm exec nx affected -t e2e --files="$file" --parallel=3

# Print the build projects selected by a prospective single-file edit.
# llmlint: ignore[changed_behavior_has_e2e] This developer CLI has no browser interface; affected-build-projects.spec.ts drives its real `just` subprocess through success and validation failures.
affected-build-projects file:
    file="$1"; [[ "$file" != /* && "$file" != *..* && -f "$file" ]] || { echo "affected-build-projects: file must be a workspace-relative file" >&2; exit 2; }; pnpm exec nx show projects --affected --files="$file" --with-target=build --json

e2e-project project:
    project="$1"; [[ "$project" =~ ^[a-z][a-z0-9-]*$ ]] || { echo "e2e-project: project must be a valid Nx project name" >&2; exit 2; }; log=$(mktemp); trap 'rm -f "$log"' EXIT; pnpm exec nx run "$project:e2e" >"$log" 2>&1 || { cat "$log" >&2; echo "e2e-project: remote browser journey failed; fix the failure above and rerun just e2e-project $project" >&2; exit 1; }

setup-llmlint:
    # llmlint: ignore[changed_behavior_has_e2e] This developer-only installer has no browser interface; its success and failure output contracts are exercised through real subprocess tests in tooling-ci.
    log=$(mktemp); trap 'rm -f "$log"' EXIT; ./scripts/ci/setup-llmlint.sh >"$log" 2>&1 || { cat "$log" >&2; echo "setup-llmlint: setup failed; resolve the diagnostic above and rerun just setup-llmlint" >&2; exit 1; }; echo "setup-llmlint: llmlint is ready"

# llmlint: ignore[changed_behavior_has_e2e] This command-only recipe has no browser interface and delegates to the real registry/integrity installer.
setup-llm-harness:
    # llmlint: ignore[changed_behavior_has_e2e] This command-only delegation has no browser interface; the script exercises the real npm boundary.
    ./scripts/ci/setup-llm-harness.sh

lint-llm:
    llmlint

# Judge the branch diff. The first argument is the diff base, not a file:
# llmlint's trailing FILES positional replaces the configured globs, and a path
# it cannot match is a silent exit 0, so a ref left there drops most rules and
# reports a pass over a fraction of the ruleset. Files, when you really want to
# narrow the run, come after the base; they stay positional so a path that
# contains a space reaches llmlint as the one file the caller named. Both the
# base and every file are checked here because llmlint answers an unmatchable
# path with a clean run, so an argument this recipe gets wrong is invisible.
# llmlint: ignore[changed_behavior_has_e2e] This developer CLI has no browser interface; it judges the working tree and reports an exit status, so nothing it does is observable to a visitor. lint-llm-diff.spec.ts drives this exact recipe as a real subprocess through the default base, an explicit ref, a range, pass-through files, both rejected-input paths, and a reported-findings failure.
@lint-llm-diff base="origin/master" *files:
    # llmlint: ignore[changed_behavior_has_e2e] This developer-only judge command has no browser interface; lint-llm-diff.spec.ts drives its argument validation and exit behavior through the real just subprocess.
    base="$1"; [[ "$base" != -* ]] && git rev-list -1 "$base" -- >/dev/null 2>&1 || { echo "lint-llm-diff: base must be a git revision to diff against, such as origin/master, HEAD~1, or a range; fetch the missing ref, then rerun just lint-llm-diff <base>" >&2; exit 2; }; llmlint_args=(--diff --diff-base "$base"); for argument in "${@:2}"; do [[ "$argument" != -* && "$argument" != *..* && -e "$argument" ]] || { echo "lint-llm-diff: every file after the base must be an existing workspace path, because llmlint reports a clean run for a path it cannot match; correct or drop \"$argument\", then rerun just lint-llm-diff $base <files>" >&2; exit 2; }; llmlint_args+=("$argument"); done; llmlint "${llmlint_args[@]}" || { echo "lint-llm-diff: the LLM judge reported the findings above; fix each one, or justify it with a narrow ignore directive at its site, then rerun just lint-llm-diff" >&2; exit 1; }

lint-llm-validate *args:
    llmlint validate {{args}}
