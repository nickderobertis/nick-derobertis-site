<!-- llmlint: ignore-file[instruction_layer_localized] The root journey inventory is deliberately a shell-wide federation contract: every feature must be exercised through both its standalone remote and host-composed boundary, so localizing those coupled journeys under individual apps would split the single end-to-end ownership model. -->
# Repository instructions

## Stack and composition

- Product shape: React web app monorepo (Nx, rspack, Module Federation 2.0).
- Language: TypeScript.
- References composed: `base.md`, `shapes/web-app.md`, `shapes/react.md`, `languages/typescript.md`, `ci.md`, `llmlint.md`, `monorepo.md`.
- Excluded: bun, because it is incompatible with the supported workspace path for Nx's rspack Module Federation executor; pnpm's workspace linker is required here. Also excluded: release automation, because GitHub Pages deployment is the artifact lifecycle; server/auth guidance, because this is a public static site with no privileged actions.
- Coverage is 95% for library code. Shell markup is principally verified through real-browser e2e journeys.

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
core.hooksPath .githooks`). Galleries are published at
`https://nickderobertis.github.io/nick-derobertis-site-visual-docs/` from the
dedicated visual-docs repository. They cannot be hosted on this repository's
`gh-pages` branch because its production Pages site is served from an Actions
artifact, so GitHub does not serve that branch. Pin screencomp `v0.4.5`
consistently across the
reusable-workflow ref, the `screencomp-version` input, and the bootstrap CLI
install; `scripts/verify-visual-contract.mjs` guards that and the toggle/baseline
contracts. Per-app baselines/galleries and the `reference/screenshots` PR #12
baseline are retained.

## Workflow

Use `just` as the only command surface. `just check` is the full pre-push gate. Add user-visible behavior with accessible real-browser coverage. Validate imported CV data with schemas at the boundary. Screenshot capture is intentionally not part of `just check`: the deterministic visual drift gate is screencomp's reusable workflow, with the `.githooks/pre-push` guard as its local half (it re-captures only affected microfrontends when `[guard].paths` change and blocks the push until a regenerated baseline is committed).

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

This numbered inventory is the browser-test contract; extend it with every new route, feature, or state.

1. Site shell: all five Pages-base routes load directly with header, footer, route content, and no failed assets; keyboard navigation works; each route retains useful substantive prerendered HTML without JavaScript; unknown paths show the static 404 recovery document and client-side redirect home; `/story` redirects to `/bio`.
2. Federation ownership: all 12 remotes render without failed assets through both standalone and host-composed boundaries.
3. Home: its composed page and carousel, cards, story, contact, timeline, skills, and awards panes cover happy, empty, loading, and error states in both render paths; action links, automatic and keyboard carousel controls, responsive breakpoints, and invalid build-script inputs are covered.
4. Bio: complete story, responsive layout, and happy, empty, loading, and error states in both render paths.
5. Research: category groupings, optional coauthors/resources, narrow and standard layouts, async recovery, and happy, empty, loading, and error states in both render paths.
6. Software: project totals, optional fields, responsive grids, and happy, empty, loading, and error states in both render paths.
7. Courses: course topics, full and sparse records, responsive panes, and happy, empty, loading, and error states in both render paths.
8. Timeline: complete CV history; education, employment, and no-result filters; compact mobile labels; invalid-state recovery; shared styles; and happy, empty, loading, and error states in both render paths.
9. Skills: recursive tree, pointer and keyboard stats, category drill-down, accessible selectors, responsive layouts, invalid-state recovery, shared styles, and happy, empty, loading, and error states in both render paths.
10. Awards: selected and complete sets, optional card content, statistics, responsive layouts, async recovery, and happy, empty, loading, and error states in both render paths.

Substantial scenarios must remain real-browser covered through standalone and host-composed paths. Keep one Nx-bounded remote per feature domain, exposed only at the route boundary; no cross-remote internals or mixed domains.

## Commits, releases, and merging

Use Conventional Commits. GitHub uses squash-only merging, auto-merge, deleted head branches, and protected `master` requiring `check` and `llmlint`; admins may override. The visual drift gate is requirable as the `Visual docs` workflow's `classify-gate` status check — a stable aggregate over screencomp's per-app classify legs (whose own matrix contexts, `visual-docs / report (x86_64, <app>, …)`, vary with the affected set), passing when classify is clean or when no visual microfrontend was affected.
