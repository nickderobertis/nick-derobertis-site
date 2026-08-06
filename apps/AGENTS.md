# Application instructions

Keep each application as an Nx project with uniform `build`, `lint`, `test`, and
`typecheck` targets. The shell owns routing and layout. Route applications are
federated remotes: pin their public paths below the GitHub Pages project base,
expose their route page, and consume other remotes only through declared
federation boundaries.

## What an app owns

Every app owns its own tests. There is no shell-wide suite that covers another
app's behavior, so a change to one app selects, runs, and can only break that
app's own gates:

- `apps/<app>/e2e/` — a Playwright suite with its own `playwright.config.ts`,
  built by `defineAppE2eConfig` from `@site/e2e-harness` so every app serves the
  real composed artifact on its own port. Each remote's `ownership.spec.ts`
  registers `remoteOwnershipTests`, which drives that remote through both its
  standalone document and the host that composes it. The journeys the app owns
  beyond that are listed below in its own `AGENTS.md`.
- `apps/<app>/visual/scenarios.ts` — the visual scenarios screencomp captures,
  with `capture.ts` and the committed `baseline/x86_64.json` beside it. The
  shell has no `screenshot` target, so it is the one app with no `visual/`.
- `apps/<app>/src/**/*.spec.tsx` — a component spec beside every component,
  behind the 95% four-metric coverage floor `apps/<app>/vite.config.ts`
  declares through `defineWorkspaceTestConfig`.

`scripts/workspace/structure-contract.spec.ts` derives all of that from the Nx
project graph and fails when an app is missing any of it.

## Journeys

Each app's `AGENTS.md` carries the browser-test contract for the journeys it
owns; extend the owning app's list with every new route, feature, or state.
Substantial scenarios must remain real-browser covered through both the
standalone remote and the host-composed boundary. Keep one Nx-bounded remote per
feature domain, exposed only at the route boundary; no cross-remote internals or
mixed domains.
