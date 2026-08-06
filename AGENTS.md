# Repository instructions

## Stack and composition

- Product shape: React web app monorepo (Nx, rspack, Module Federation 2.0).
- Language: TypeScript.
- References composed: `base.md`, `shapes/web-app.md`, `shapes/react.md`, `languages/typescript.md`, `ci.md`, `llmlint.md`, `monorepo.md`.
- Excluded: bun, because it is incompatible with the supported workspace path for Nx's rspack Module Federation executor; pnpm's workspace linker is required here. Also excluded: release automation, because GitHub Pages deployment is the artifact lifecycle; server/auth guidance, because this is a public static site with no privileged actions.
- Coverage is 95% on lines, functions, branches, and statements, and it now covers app UI as well as library code: every app and library `test` target runs Vitest through a `vite.config.ts` built by `defineWorkspaceTestConfig`, which declares that four-metric floor. The `tooling-*` projects are the one exemption — their subjects are `just` recipes, git hooks, and CLIs driven as real subprocesses, which v8 cannot instrument from the test process — so their gate is instead the subject inventory in `scripts/workspace/structure-contract.spec.ts`: every `scripts/**/*.mjs`, every `just` recipe, and every hook must be driven by a spec or record why it cannot be. Browser journeys remain the principal verification for markup, composition, and recovery.

Use pnpm; never add backend or runtime API infrastructure. The shell owns routing and layout. It consumes five route remotes; Home is itself a host for seven feature remotes. Remotes expose only route pages and compose only declared child remotes. Libraries flow `shared -> layout -> shell`, enforced by Nx tags. See `docs/architecture.md`.

Visual regression uses screencomp's canonical reusable workflow
(`nickderobertis/screencomp/.github/workflows/visual-docs-reusable.yml@v0.4.5`)
via `.github/workflows/visual-docs.yml`, superseding the prior hand-rolled
capture/classify/gallery/comment/Pages pipeline (whose host-based capture proof
`docs/integration-proof.md` records). Capture is owned by screencomp's pinned
Linux container, so it is deterministic with no cross-environment flake and no
second host-based drift gate. Affected-only economics are preserved: an upstream
`affected` job turns `nx affected --with-target screenshot` into the reusable
workflow's dynamic `projects` matrix (one lane per affected microfrontend, each
pinned to its own `apps/<app>/visual/baseline/x86_64.json` manifest and gallery),
so an unaffected app is never captured or classified — never reported as removed.
That per-project `manifest` wiring is the mechanism used here; it is equivalent
to `screencomp classify --include project=<app>` scoping against a shared
baseline. The single drift gate is the reusable workflow's classify job (surfaced
as the `Visual docs` workflow's stable `classify-gate` status check); its local
half is `.githooks/pre-push` (enable once per clone with `git config
core.hooksPath .githooks`). Galleries are published per project from the
dedicated visual-docs repository — canonical ones at
`https://nickderobertis.github.io/nick-derobertis-site-visual-docs/<project>/x86_64/`
and pull-request previews at
`https://nickderobertis.github.io/nick-derobertis-site-visual-docs/pr-<number>/<project>/x86_64/`.
There is no root index; the aggregated pull-request comment carries the direct
links and is the intended entry point. Only affected projects are deployed, so
most projects have no gallery at any given moment. Galleries cannot be hosted
on this repository's `gh-pages` branch because its production Pages site is
served from an Actions artifact, so GitHub does not serve that branch. Pin screencomp `v0.4.5`
consistently across the
reusable-workflow ref, the `screencomp-version` input, and the bootstrap CLI
install; `scripts/visual/verify-visual-contract.mjs` guards that and the toggle/baseline
contracts. Per-app baselines/galleries and the `reference/screenshots` PR #12
baseline are retained.

Pages deploys per app: one publish lane per affected app writes only its own
`apps/<app>/` subtree to the `published-fragments` content-store branch, and one
serialized lane composes and uploads. Never make the content-store branch the
served source, never move Pages off `build_type: workflow`, and never drop the
deploy lane's `queue: max` with `cancel-in-progress: false`: each of those
breaks deploys.

## Workflow

<!-- llmlint: ignore[contracts_have_one_source_or_a_drift_gate] This contributor-facing ownership inventory is deliberately explicit; module-boundaries.spec.ts verifies every scripts project is tagged tooling and owns the required targets, while Nx remains the project source of truth. -->
Use `just` as the only command surface. `just check` is the full pre-push gate. Workspace tooling lives in `scripts/`, which is eight Nx projects that each own their CLIs and the specs driving them; add a new tooling spec to the project that owns its subject. Add user-visible behavior with accessible real-browser coverage, and add it to the owning app: a new component needs a `.spec.tsx` beside it, a new state or feature needs a journey in that app's own `e2e/` suite and a scenario in its own `visual/scenarios.ts`. Validate imported CV data with schemas at the boundary. Screenshot capture belongs to each app rather than to a centralized script: `apps/<app>/visual/scenarios.ts` declares that app's scenarios, `capture.ts` beside it drives them through `captureVisualSuite` from `@site/visual-harness`, and the app's own `screenshot` target runs it. Capture is intentionally not part of `just check`: the deterministic visual drift gate is screencomp's reusable workflow, with the `.githooks/pre-push` guard as its local half (it re-captures only affected microfrontends when `[guard].paths` change and blocks the push until a regenerated baseline is committed).

Dependency freshness is checked with `pnpm outdated`; every dependency's
`current` version must equal its `wanted` version. Major rspack and TypeScript
updates remain outside those constraints until their Nx integrations support
them; `just upgrade` deliberately opts into testing latest releases.

The `justfile` is the authoritative source for the repo-scoped
`NX_CACHE_DIRECTORY` default beneath the user's standard cache directory, so
disposable worktrees reuse Nx's content-addressed local cache. An existing
`NX_CACHE_DIRECTORY` overrides the default. Use this shared local cache only
when Nx dispatch concurrency is 1:
parallel Nx processes sharing its cache database can encounter SQLite lock or
foreign-key contention. Higher-concurrency dispatches require Nx's supported
cache locking or a remote cache.

## Journeys

Every app owns its tests. `apps/<app>/e2e/` is that app's Playwright suite with its own `playwright.config.ts`, `apps/<app>/visual/scenarios.ts` is its visual inventory, and `apps/<app>/src/**/*.spec.tsx` are its component specs — so a change to one app selects, runs, and can only break that app's own gates. The browser-test contract for each app's journeys lives in its own `apps/<app>/AGENTS.md`; extend the owning app's list with every new route, feature, or state. `apps/AGENTS.md` states what every app owns.

Federation ownership is the one contract no single app can state alone, and it is not restated per app either: `remoteOwnershipTests` in `@site/e2e-harness` registers it, each remote's `apps/<app>/e2e/ownership.spec.ts` calls it for the remote it owns, and the harness resolves the route inventory, each remote's landmark and loading status, and Home's panes against the manifests that publish them — `apps/shell/src/routes.json`, `libs/build-config/src/remotes.json`, and the composition in `apps/home/rspack.config.ts` — failing by name when the two disagree. So every one of the 12 remotes renders without failed assets through both its standalone and host-composed boundary, and a new route or pane cannot ship without the journeys that cover it.

Substantial scenarios must remain real-browser covered through standalone and host-composed paths. Keep one Nx-bounded remote per feature domain, exposed only at the route boundary; no cross-remote internals or mixed domains.

## Commits, releases, and merging

Use Conventional Commits. GitHub uses squash-only merging, auto-merge, deleted head branches, and protected `master` requiring `check` and `llmlint`; admins may override. The visual drift gate is requirable as the `Visual docs` workflow's `classify-gate` status check — a stable aggregate over screencomp's per-app classify legs (whose own matrix contexts, `visual-docs / report (x86_64, <app>, …)`, vary with the affected set), passing when classify is clean or when no visual microfrontend was affected.
