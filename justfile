set shell := ["bash", "-euo", "pipefail", "-c"]

bootstrap:
    corepack enable
    pnpm install --frozen-lockfile
    pnpm exec playwright install chromium

check: test
    pnpm exec biome check .
    pnpm exec nx affected -t lint,typecheck,test,build,e2e --base="${NX_BASE:-HEAD~1}" --head="${NX_HEAD:-HEAD}" --parallel=3

test:
    pnpm exec nx run-many -t test,e2e --all

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
