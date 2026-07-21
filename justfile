set shell := ["bash", "-euo", "pipefail", "-c"]

# Bun is explicitly ruled out: Nx's rspack Module Federation executor supports
# this workspace through pnpm's linker. pnpm is the documented fallback in
# AGENTS.md and the composed Stack-and-composition record.
bootstrap:
    corepack enable
    pnpm install --frozen-lockfile --reporter=silent || { echo "bootstrap: dependency install failed; check the lockfile and registry access, then rerun just bootstrap" >&2; exit 1; }
    pnpm exec playwright install chromium >/dev/null || { echo "bootstrap: Chromium install failed; check Playwright system requirements, then rerun just bootstrap" >&2; exit 1; }
    command -v screencomp >/dev/null || (curl -fsSL https://raw.githubusercontent.com/nickderobertis/screencomp/main/scripts/install.sh | sh -s -- --version v0.4.2 >/dev/null) || { echo "bootstrap: screencomp install failed; check network access and rerun just bootstrap" >&2; exit 1; }

bootstrap-ci:
    pnpm install --frozen-lockfile --reporter=silent || { echo "bootstrap-ci: dependency install failed; check the lockfile and registry access, then rerun just bootstrap-ci" >&2; exit 1; }

visual-affected:
    node scripts/verify-visual-contract.mjs
    git rev-parse --verify "$NX_BASE^{commit}" >/dev/null && git rev-parse --verify "$NX_HEAD^{commit}" >/dev/null || { echo "visual-affected: NX_BASE and NX_HEAD must resolve to commits" >&2; exit 2; }
    pnpm exec nx show projects --affected --with-target screenshot --base="$NX_BASE" --head="$NX_HEAD" > affected-visual-projects.txt
    log=$(mktemp); trap 'rm -f "$log"' EXIT; pnpm exec nx affected -t screenshot --base="$NX_BASE" --head="$NX_HEAD" --parallel=3 >"$log" 2>&1 || { cat "$log" >&2; echo "visual-affected: capture failed; rerun the failed project's just visual-project target locally" >&2; exit 1; }

visual-project project:
    scripts/visual-project.sh {{project}}

visual-publish-project baseline current gallery comment gallery_url:
    scripts/publish-visual-project.sh {{baseline}} {{current}} {{gallery}} {{comment}} {{gallery_url}}

verify-visual-reference:
    node scripts/verify-reference-migration.mjs

check: test
    base="${NX_BASE:-HEAD~1}"; head="${NX_HEAD:-HEAD}"; git rev-parse --verify "$base^{commit}" >/dev/null && git rev-parse --verify "$head^{commit}" >/dev/null || { echo "check: NX_BASE and NX_HEAD must resolve to commits" >&2; exit 2; }; log=$(mktemp); trap 'rm -f "$log"' EXIT; pnpm exec biome check --error-on-warnings . >"$log" 2>&1 && pnpm exec nx affected -t lint --base="$base" --head="$head" --parallel=3 --args="--error-on-warnings" >>"$log" 2>&1 && pnpm exec nx affected -t typecheck,test,build,prerender,e2e,screenshot --base="$base" --head="$head" --parallel=3 >>"$log" 2>&1 || { cat "$log" >&2; echo "check: quality gate failed; fix the findings above and rerun just check" >&2; exit 1; }

# CI runs this non-PR safety sweep so affected detection is never the only gate.
check-all:
    log=$(mktemp); trap 'rm -f "$log"' EXIT; pnpm exec biome check --error-on-warnings . >"$log" 2>&1 && pnpm exec nx run-many -t lint --all --parallel=3 --args="--error-on-warnings" >>"$log" 2>&1 && pnpm exec nx run-many -t typecheck,test,build,prerender,e2e,screenshot --all --parallel=3 >>"$log" 2>&1 || { cat "$log" >&2; echo "check-all: quality gate failed; fix the findings above and rerun just check-all" >&2; exit 1; }

test:
    base="${NX_BASE:-HEAD~1}"; head="${NX_HEAD:-HEAD}"; git rev-parse --verify "$base^{commit}" >/dev/null && git rev-parse --verify "$head^{commit}" >/dev/null || { echo "test: NX_BASE and NX_HEAD must resolve to commits" >&2; exit 2; }; log=$(mktemp); trap 'rm -f "$log"' EXIT; pnpm exec nx affected -t test,e2e --base="$base" --head="$head" --parallel=3 >"$log" 2>&1 || { cat "$log" >&2; echo "test: browser or unit tests failed; fix the findings above and rerun just test" >&2; exit 1; }

lint:
    log=$(mktemp); trap 'rm -f "$log"' EXIT; pnpm exec nx run-many -t lint --all --args="--error-on-warnings" >"$log" 2>&1 && pnpm exec nx run-many -t typecheck --all >>"$log" 2>&1 || { cat "$log" >&2; echo "lint: lint or typecheck failed; fix the findings above and rerun just lint" >&2; exit 1; }

format:
    pnpm exec biome check --write .

upgrade:
    pnpm update --latest --recursive
    just check

test-e2e:
    pnpm exec nx run shell-e2e:e2e

setup-llmlint:
    ./scripts/setup-llmlint.sh

lint-llm:
    llmlint

lint-llm-diff *args:
    llmlint --diff --diff-base "origin/master" {{args}}

lint-llm-validate *args:
    llmlint validate {{args}}
