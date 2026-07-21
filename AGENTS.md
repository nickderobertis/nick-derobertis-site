# Repository instructions

## Stack and composition

- Product shape: React web app monorepo (Nx, rspack, Module Federation 2.0).
- Language: TypeScript.
- References composed: `base.md`, `shapes/web-app.md`, `shapes/react.md`, `languages/typescript.md`, `ci.md`, `llmlint.md`, `monorepo.md`.
- Excluded: bun, because it is incompatible with the supported workspace path for Nx's rspack Module Federation executor; pnpm's workspace linker is required here. Also excluded: release automation, because GitHub Pages deployment is the artifact lifecycle; server/auth guidance, because this is a public static site with no privileged actions.
- Coverage is 95% for library code. Shell markup is principally verified through real-browser e2e journeys.

Use pnpm; never add backend or runtime API infrastructure. The shell owns routing and layout. It consumes five route remotes; Home is itself a host for seven feature remotes. Remotes expose only route pages and compose only declared child remotes. Libraries flow `shared -> layout -> shell`, enforced by Nx tags. See `docs/architecture.md`.

## Workflow

Use `just` as the only command surface. `just check` is the full pre-push gate. Add user-visible behavior with accessible real-browser coverage. Validate imported CV data with schemas at the boundary.

Dependency freshness is checked with `pnpm outdated`; every dependency's
`current` version must equal its `wanted` version. Major rspack and TypeScript
updates remain outside those constraints until their Nx integrations support
them; `just upgrade` deliberately opts into testing latest releases.

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

Use Conventional Commits. GitHub uses squash-only merging, auto-merge, deleted head branches, and protected `master` requiring `check` and `llmlint`; admins may override.
