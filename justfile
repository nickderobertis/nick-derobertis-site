set shell := ["bash", "-euo", "pipefail", "-c"]

# Bun is explicitly ruled out: Nx's rspack Module Federation executor supports
# this workspace through pnpm's linker. pnpm is the documented fallback in
# AGENTS.md and the composed Stack-and-composition record.
bootstrap:
    corepack enable
    pnpm install --frozen-lockfile
    pnpm exec playwright install chromium
    command -v screencomp >/dev/null || (curl -fsSL https://raw.githubusercontent.com/nickderobertis/screencomp/main/scripts/install.sh | sh -s -- --version v0.4.2)

check: test
    pnpm exec biome check .
    pnpm exec nx affected -t lint,typecheck,test,build,prerender,e2e,screenshot --base="${NX_BASE:-HEAD~1}" --head="${NX_HEAD:-HEAD}" --parallel=3

# CI runs this non-PR safety sweep so affected detection is never the only gate.
check-all:
    pnpm exec biome check .
    pnpm exec nx run-many -t lint,typecheck,test,build,prerender,e2e,screenshot --all --parallel=3

test:
    pnpm exec nx affected -t test,e2e --base="${NX_BASE:-HEAD~1}" --head="${NX_HEAD:-HEAD}" --parallel=3

lint:
    pnpm exec nx run-many -t lint,typecheck --all

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
