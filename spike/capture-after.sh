#!/usr/bin/env bash
# SPIKE MOCK (throwaway): rebuild the redesign mock and re-capture every "after"
# image through each route app's own `screenshot` target (@site/visual-harness).
# Usage: spike/capture-after.sh   -> shots/current/<app>/x86_64/host-composed/happy/{desktop,mobile}.png
set -euo pipefail
pnpm exec nx run-many -t build --parallel=1
# compose only: the mock's raw originals deliberately exceed the bundle budgets
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/compose/compose.mjs
for app in home bio research software courses; do
  pnpm exec nx run "$app:screenshot" --exclude-task-dependencies  # skips shell:prerender, whose budget check the mock exceeds
done
