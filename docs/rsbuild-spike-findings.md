# Rsbuild + SSG evaluation spike

Date: 2026-07-21

## Recommendation

**Do not migrate the remaining applications to Rsbuild for SSG or hydration.**
Keep the first-party Nx rspack integration and make the much smaller
`createRoot` to `hydrateRoot` correction separately. Rsbuild itself and its
Module Federation plugin work for this repository, but the package named in
the proposal, `@rsbuild/plugin-ssg`, is not published. Consequently, Rsbuild
does not replace this site's prerender pipeline or provide hydration “for
free.”

## Spike boundary

Only `shell` and `bio` were changed from `@nx/rspack:rspack` plus
`rspack.config.ts` to the Rsbuild CLI plus `rsbuild.config.ts`. The other 11
application remotes remain on their existing rspack executor and configuration.
The spike uses Rsbuild 1.7.6 because it shares the repository's Rspack 1.7 line;
Rsbuild 2 requires Rspack 2, which is outside the supported Nx integration.

## Structured findings

| Claim | Result | Evidence | Decision impact |
| --- | --- | --- | --- |
| SSG provides prerendering and hydration | **Disproved / unavailable** | `pnpm view @rsbuild/plugin-ssg` returned npm `E404`; the package is also absent from the official Rsbuild plugin catalog. The Rsbuild build emitted an empty-root SPA HTML document. The existing 256-line `scripts/prerender.mjs` and 87-line `scripts/check-static-artifact.mjs` remain necessary. | No SSG or hydration benefit exists to justify migration. |
| Configuration is simpler | **Disproved for this slice** | 34 lines of rspack build config were removed and 71 lines of Rsbuild config were added: **37 more build-config lines**. The two Nx project files changed by +10/-14 lines, but lose typed first-party executors in favor of string CLI commands and explicit output declarations. Zero scripts and zero script lines could be deleted. | The local config becomes longer and the Nx boundary less structured. |
| MF and affected selection still work | **Proved, with manual wiring** | The complete Pages artifact built, `dist/apps/shell/remotes/bio/remoteEntry.js` exists, and 13 real Chromium `bio` journeys passed across standalone and host-composed paths. `nx show projects --affected --files=apps/bio/rsbuild.config.ts --json` returned only `["bio"]`; the equivalent shell command returned only `["shell"]`. | Rsbuild is technically viable for MF and Nx selection, but supplies no compensating SSG benefit. |

## Hydration and CLS

The browser entry still calls `createRoot`, so it replaces the hand-written
static shell rather than hydrating it. A Chromium `PerformanceObserver` for
buffered `layout-shift` entries with `hadRecentInput === false` measured the
host-composed `/bio` route after `networkidle` plus one second at the standard
desktop viewport.

| Artifact | CLS |
| --- | ---: |
| `origin/master` rspack + hand-written prerender | 0.0625625949435764 |
| spike Rsbuild + hand-written prerender | 0.0625625949435764 |
| Delta | 0 |

The exact unchanged result is expected: a bundler migration does not change
the React root API. Because the proposed SSG plugin cannot be installed, there
is no honest “plugin after” artifact to measure. The spike therefore does not
fix the existing layout shift. A one-line root API correction remains the
appropriate experiment for that problem.

## Module Federation and Pages evidence

Both migrated projects built with `@module-federation/rsbuild-plugin` and
emitted `remoteEntry.js`, `mf-manifest.json`, and `mf-stats.json`. The existing
Pages staging step copied the Rsbuild `bio` artifact alongside the rspack
remotes. The existing browser suite then loaded `bio/Page` through the migrated
shell and independently loaded the bio standalone document; all 13 selected
tests passed. This proves the migrated host can consume both the migrated bio
remote and the unchanged rspack remotes in the mixed artifact.

## Nx integration impact

Nx still sees both applications because their explicit `project.json` targets
remain in the project graph. A change to either new config selects only its
own project. Caching also remains available because each `nx:run-commands`
target declares its output directory.

What is lost is executor knowledge: Nx no longer validates Rsbuild options,
derives the output from executor options, or starts the first-party rspack dev
server. Each migrated project must spell out its CLI config path, output, entry,
HTML template, TypeScript config, Pages base, server behavior, React plugin,
and federation plugin configuration. The shell also duplicates remote URL
construction because the shared helper is coupled to rspack plugin classes.

## Reproduction commands

```sh
pnpm view @rsbuild/plugin-ssg version
just check
just prerender
just e2e-project bio
```

## What worked and what broke

Worked: Rsbuild production builds, Rsbuild Module Federation exposure and
consumption, mixed Rsbuild/rspack Pages staging, Nx caching/affected selection,
and all selected real-browser journeys.

Broke or failed the motivating claims: the requested SSG plugin cannot be
installed, Rsbuild's generated HTML is not prerendered, no hydration is added,
CLS is unchanged, no static-build script can be removed, configuration grew,
and first-party Nx executor semantics were traded for shell commands.
