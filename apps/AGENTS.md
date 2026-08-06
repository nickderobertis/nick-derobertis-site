# Application instructions

Keep each application as an Nx project with uniform `build`, `lint`, `test`, and
`typecheck` targets. The shell owns routing and layout. Route applications are
federated remotes: pin their public paths below the GitHub Pages project base,
expose their route page, and consume other remotes only through declared
federation boundaries.

## What an app owns

Every app owns its own tests, so a change to one app selects, runs, and can only
break that app's gates:

- `apps/<app>/e2e/` — a Playwright suite with its own `playwright.config.ts`
  built by `defineAppE2eConfig`. Each remote's `ownership.spec.ts` registers
  `remoteOwnershipTests` for the remote it owns; every other journey the app
  owns belongs beside it.
- `apps/<app>/visual/scenarios.ts` — the scenarios screencomp captures, with
  `capture.ts` and the committed `baseline/x86_64.json`. Only the shell, which
  has no `screenshot` target, may omit `visual/`.
- `apps/<app>/src/**/*.spec.tsx` — a spec beside every component, behind the
  95% four-metric floor `apps/<app>/vite.config.ts` declares.

## Journeys

Substantial scenarios must remain real-browser covered through both the
standalone remote and the host-composed boundary. Keep one Nx-bounded remote per
feature domain, exposed only at the route boundary; no cross-remote internals or
mixed domains.
