# Repository instructions

## Stack and composition

- Product shape: React web app monorepo (Nx, rspack, Module Federation 2.0).
- Language: TypeScript.
- References composed: `base.md`, `shapes/web-app.md`, `shapes/react.md`, `languages/typescript.md`, `ci.md`, `llmlint.md`, `monorepo.md`.
- Excluded: bun, because rspack Module Federation's Nx integration is supported through pnpm; release automation, because GitHub Pages deployment is the artifact lifecycle; server/auth guidance, because this is a public static site with no privileged actions.
- Coverage is 95% for library code. Shell markup is principally verified through real-browser e2e journeys.

Use pnpm; never add backend or runtime API infrastructure. The shell owns routing and layout; feature remotes will compose at route boundaries. Libraries flow `shared -> layout -> shell`, enforced by Nx tags.

## Workflow

Use `just` as the only command surface. `just check` is the full pre-push gate. Add user-visible behavior with accessible real-browser coverage. Validate imported CV data with schemas at the boundary.

## Journeys

E2E visits all five routes at the Pages base path, verifies shared layout and route content, keyboard navigation, direct deep links, and the 404 fallback.

## Commits, releases, and merging

Use Conventional Commits. GitHub uses squash-only merging, auto-merge, deleted head branches, and protected `master` requiring `check` and `llmlint`; admins may override.
