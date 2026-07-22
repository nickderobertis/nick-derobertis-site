set shell := ["bash", "-euo", "pipefail", "-c"]
set positional-arguments := true

# Bun is explicitly ruled out: Nx's rspack Module Federation executor supports
# this workspace through pnpm's linker. pnpm is the documented fallback in
# AGENTS.md and the composed Stack-and-composition record.
bootstrap:
    if ! command -v pnpm >/dev/null; then pnpm_bin_dir="${XDG_BIN_HOME:-$HOME/.local/bin}"; mkdir -p "$pnpm_bin_dir"; corepack enable --install-directory "$pnpm_bin_dir" || { echo "bootstrap: pnpm is unavailable and Corepack could not install a user-scoped shim; verify the Node installation and writable XDG_BIN_HOME, then rerun just bootstrap" >&2; exit 1; }; export PATH="$pnpm_bin_dir:$PATH"; fi
    log=$(mktemp); trap 'rm -f "$log"' EXIT; pnpm install --frozen-lockfile --reporter=silent >"$log" 2>&1 || { cat "$log" >&2; echo "bootstrap: dependency install failed; check the lockfile and registry access, then rerun just bootstrap" >&2; exit 1; }
    scripts/setup-ci-tools.sh || { echo "bootstrap: pinned CI tool installation failed; check the reported checksum or network error, then rerun just bootstrap" >&2; exit 1; }
    log=$(mktemp); trap 'rm -f "$log"' EXIT; pnpm exec playwright install chromium >"$log" 2>&1 || { cat "$log" >&2; echo "bootstrap: Chromium install failed; check Playwright system requirements, then rerun just bootstrap" >&2; exit 1; }
    if ! command -v screencomp >/dev/null; then log=$(mktemp); trap 'rm -f "$log"' EXIT; (curl -fsSL https://raw.githubusercontent.com/nickderobertis/screencomp/main/scripts/install.sh | sh -s -- --version v0.4.2) >"$log" 2>&1 || { cat "$log" >&2; echo "bootstrap: screencomp install failed; check network access and rerun just bootstrap" >&2; exit 1; }; fi

bootstrap-ci:
    log=$(mktemp); trap 'rm -f "$log"' EXIT; pnpm install --frozen-lockfile --reporter=silent >"$log" 2>&1 || { cat "$log" >&2; echo "bootstrap-ci: dependency install failed; check the lockfile and registry access, then rerun just bootstrap-ci" >&2; exit 1; }
    scripts/setup-ci-tools.sh || { echo "bootstrap-ci: pinned CI tool installation failed; check the reported checksum or network error, then rerun just bootstrap-ci" >&2; exit 1; }

lint-workflows:
    scripts/setup-ci-tools.sh --verify >/dev/null
    .tools/bin/actionlint .github/workflows/*.yml || { echo "lint-workflows: GitHub workflow validation failed; fix the actionlint findings above, then rerun just lint-workflows" >&2; exit 1; }
    .tools/bin/shellcheck scripts/*.sh || { echo "lint-workflows: shell validation failed; fix the shellcheck findings above, then rerun just lint-workflows" >&2; exit 1; }

visual-affected:
    node scripts/verify-visual-contract.mjs || { echo "visual-affected: visual tool pins or toggle contracts drifted; update visual-tools.json and every named consumer together" >&2; exit 1; }
    git rev-parse --verify "$NX_BASE^{commit}" >/dev/null && git rev-parse --verify "$NX_HEAD^{commit}" >/dev/null || { echo "visual-affected: NX_BASE and NX_HEAD must resolve to commits" >&2; exit 2; }
    pnpm exec nx show projects --affected --with-target screenshot --base="$NX_BASE" --head="$NX_HEAD" > affected-visual-projects.txt || { echo "visual-affected: Nx project selection failed; verify the revisions and rerun just visual-affected" >&2; exit 1; }
    log=$(mktemp); trap 'rm -f "$log"' EXIT; pnpm exec nx affected -t screenshot --base="$NX_BASE" --head="$NX_HEAD" --parallel=3 >"$log" 2>&1 || { cat "$log" >&2; echo "visual-affected: capture failed; rerun the failed project's just visual-project target locally" >&2; exit 1; }

visual-project project:
    project="$1"; [[ "$project" =~ ^[a-z][a-z0-9-]*$ ]] || { echo "visual-project: project must be a valid Nx project name" >&2; exit 2; }; scripts/visual-project.sh "$project"

visual-publish-project baseline current gallery comment gallery_url:
    scripts/publish-visual-project.sh "$1" "$2" "$3" "$4" "$5"

verify-visual-reference:
    node scripts/verify-reference-migration.mjs || { echo "verify-visual-reference: PR #12 migration verification failed; repair the migration map or its owned baselines and retry" >&2; exit 1; }

check: test lint-workflows
    # CI=1 is the supported warnings-as-errors contract for the Nx compiler,
    # bundler, prerender, Playwright, and screenshot executors in this workspace.
    base="${NX_BASE:-HEAD~1}"; head="${NX_HEAD:-HEAD}"; git rev-parse --verify "$base^{commit}" >/dev/null && git rev-parse --verify "$head^{commit}" >/dev/null || { echo "check: NX_BASE and NX_HEAD must resolve to commits" >&2; exit 2; }; log=$(mktemp); trap 'rm -f "$log"' EXIT; pnpm exec biome check --error-on-warnings . >"$log" 2>&1 && CI=1 pnpm exec nx affected -t lint --base="$base" --head="$head" --parallel=3 --args="--error-on-warnings" >>"$log" 2>&1 && CI=1 pnpm exec nx affected -t typecheck,test,build,prerender,e2e,screenshot --base="$base" --head="$head" --parallel=3 >>"$log" 2>&1 && CI=1 pnpm exec nx run shell-e2e:integration >>"$log" 2>&1 || { cat "$log" >&2; echo "check: quality gate failed; fix warnings and errors above, then rerun just check" >&2; exit 1; }

# CI runs this non-PR safety sweep so affected detection is never the only gate.
check-all: lint-workflows
    # Keep the same CI warnings-as-errors contract during the non-affected sweep.
    log=$(mktemp); trap 'rm -f "$log"' EXIT; pnpm exec biome check --error-on-warnings . >"$log" 2>&1 && CI=1 pnpm exec nx run-many -t lint --all --parallel=3 --args="--error-on-warnings" >>"$log" 2>&1 && CI=1 pnpm exec nx run-many -t typecheck,test,build,prerender,e2e,screenshot --all --parallel=3 >>"$log" 2>&1 && CI=1 pnpm exec nx run shell-e2e:integration >>"$log" 2>&1 || { cat "$log" >&2; echo "check-all: quality gate failed; fix warnings and errors above, then rerun just check-all" >&2; exit 1; }

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
    log=$(mktemp); trap 'rm -f "$log"' EXIT; pnpm exec nx run shell-e2e:integration >"$log" 2>&1 || { cat "$log" >&2; echo "test-e2e: browser integration failed; fix the failing journey above and rerun just test-e2e" >&2; exit 1; }

prerender:
    log=$(mktemp); trap 'rm -f "$log"' EXIT; pnpm exec nx run shell:prerender >"$log" 2>&1 || { cat "$log" >&2; echo "prerender: static Pages artifact failed; fix the build or artifact validation above and rerun just prerender" >&2; exit 1; }

# Build the complete federated artifact before serving it at the Pages base path.
serve: prerender
    node scripts/serve-e2e.mjs

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
    ./scripts/setup-llmlint.sh

lint-llm:
    llmlint

lint-llm-diff *args:
    llmlint --diff --diff-base "origin/master" {{args}}

lint-llm-validate *args:
    llmlint validate {{args}}
