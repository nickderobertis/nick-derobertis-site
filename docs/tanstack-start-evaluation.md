# TanStack Start evaluation

Issue #92's F1b asks whether TanStack Start should replace the hand-driven SSR
in this repository. This record answers that and nothing else: it is the
material the scheduling decision is made from, not a plan and not an approval.
Nothing here is scheduled, and no work follows from it.

The recommendation is at the end: **do not schedule it today**, with the one
fact that would change that.

## What was read, and how to re-read it

Package claims below were read from the published tarballs of
`@tanstack/react-start@1.168.49` and `@tanstack/start-plugin-core@1.171.39`,
the latest releases on 2026-08-29. Both ship their TypeScript sources
(`files` includes `src`), so every citation is a manifest field, an export-map
entry, or a module path with a line number inside those tarballs:

```console
$ npm pack @tanstack/react-start @tanstack/start-plugin-core
$ tar xzf tanstack-start-plugin-core-1.171.39.tgz   # sources under package/src
```

Repository claims are of two kinds, and each is labelled where it is made.
A claim about **how the repository is wired** cites the configuration or
workflow file that wires it. A claim about **what the repository does** was
checked against the artifact a real build produced, not against its source:

```console
$ pnpm install --frozen-lockfile && CI=1 pnpm exec nx run shell:prerender
 NX   Successfully ran target prerender for project shell and 13 tasks it depends on
```

That run — 50.3s, cold cache, 2026-08-29 — produced `dist/apps/shell` (the
deployed artifact) and `dist/fragment-renderers` (the second compilation's
output). Both are quoted below by file count and by byte size.

## What it absorbs

**The hand-driven SSR lifecycle.** `libs/build-config/src/shell-fragment-entry.tsx`
is 77 lines that build one `Request` per route (`:40-56`), spin on
`router.serverSsr?.isSerializationFinished()` (`:58-59`), call `prerender` from
`react-dom/static` (`:60`), then `setRenderFinished()` and `takeBufferedHtml()`
(`:61-64`) — the two members `@tanstack/router-core` annotates framework-only,
and which resolve here through an unpinned transitive `@tanstack/router-core@1.171.15`
(`pnpm-lock.yaml:3103`) rather than the pinned `@tanstack/react-router@1.170.18`
(`package.json:12`). Start owns exactly that loop. Its rsbuild adapter loads the
built server bundle's default fetch handler
(`package/src/rsbuild/post-build.ts:77-96`), issues one `Request` per page
against it (`:55-65`), and its crawler writes each page's HTML
(`package/src/prerender.ts:181,198`). The framework-only calls disappear into
the framework that owns them.

**The second rspack compilation.** `PublishedFragmentPlugin.compileRenderer`
(`libs/build-config/src/published-fragment.ts:117-188`) hand-configures a whole
second `rspack({ mode: "production", target: "node", … })` build — its own
swc-loader rule, its own CSS rule, its own `@site-fragment/*` aliases — inside
an `afterEmit` hook. It runs once per app: the build above left 13 directories
under `dist/fragment-renderers/`, each holding a `render.cjs`
(`shell/render.cjs` 2,746,619 bytes; `awards/render.cjs` 2,388,735 bytes).
Start's rsbuild adapter declares the same thing as a first-class `ssr`
environment beside `client` (`package/src/rsbuild/planning.ts:12-15`, `:164-196`),
configured by the same tool that builds the client rather than by a compiler
constructed by hand in a plugin hook.

**Part of compose's document assembly.** Start writes whole documents
(`package/src/prerender.ts:181` joins `index.html` onto each page path), owns
`<head>` through the router, and can inline route CSS into the SSR response
(`package/src/schema.ts:173-198` and `:232-243`, both marked
`@experimental`). Those overlap what `scripts/compose/compose.mjs` does at
`:423-437` (title, description, canonical) and `:410-422` (per-route CSS dedup
and inlining). The built artifact shows that work: `dist/apps/shell/index.html`
is 100,569 bytes carrying `<div id="root" data-prerendered-route="/">`, one
`$_TSR.router=` hydration script, and eight `data-prerender-remote-css` style
blocks.

## What it does not absorb

The 12-remote split, the per-app publish lanes, and the content-store compose
model **all survive a Start migration** — unabsorbed. Start replaces the
shell's half of the work and leaves the federated half exactly where it is,
plus one new seam between them.

**The 12-remote Module Federation split survives and is unhelped.** Neither
published package mentions Module Federation anywhere in its sources: grepping
`module-federation|ModuleFederation` across `package/src` of both tarballs
returns no match. Federation would keep coming from a separate plugin, and for
an Rsbuild build that is `@module-federation/rsbuild-plugin` (2.9.0, peer
`@rsbuild/core: ^1.3.21 || ^2.0.0-0`), not the `@module-federation/enhanced/rspack`
this repository imports at `libs/build-config/src/rspack-remote.ts:2` and
`apps/shell/rspack.config.ts:1`. Whether Start's environment plan and MF's
container plumbing coexist is answered by neither package.

There is concrete reason to think it needs proving. Start's rsbuild adapter
claims settings the remotes already own: it sets the client environment's
`source.entry` to a single `index` with `html: false`, forces
`splitChunks: { preset: "none", chunks: "async" }`, and sets `output.distPath`
and `output.assetPrefix` itself (`package/src/rsbuild/planning.ts:134-163`).
Each remote today sets its own `output.publicPath` and
`optimization.runtimeChunk: false` (`libs/build-config/src/rspack-remote.ts:39,46-47`)
and exposes `./Page` and `./Skeleton` (`:66-69`); the shell additionally sets
`shareStrategy: "loaded-first"` for a documented reason
(`apps/shell/rspack.config.ts:28-39`). Exposes and share scopes have no Start
counterpart at all.

**The per-app publish lanes survive and gain nothing.** `.github/workflows/pages.yml:36-71`
selects lanes from the affected set, `:78-110` builds exactly one app per lane
and writes only its own subtree, and `:123-140` composes and deploys once. That
model works because each app publishes a *fragment* — `fragment.html`,
`fragment.css`, `fragment.json` — rather than a document. Start's prerender
writes documents into the client output directory
(`package/src/prerender.ts:181,198`) and has no fragment concept, so it could
stand in for a lane's output only if one app prerendered. Thirteen do: the
build above produced a `fragment.html` per app, with the shell's carrying the
five route templates (`data-shell-route` for `/`, `/bio`, `/research`,
`/software`, `/courses`) and each remote's carrying that remote's markup.

**GitHub Pages survives, and is the constraint Start fits least naturally.**
Start's build output is a server bundle whose default export is a fetch handler
(`package/src/rsbuild/post-build.ts:77-96`); prerendering is a post-build pass
over that handler, enabled by configuration
(`package/src/schema.ts:158-171` and `:270-284`, `package/src/post-build.ts:17-51`).
Static-only output is therefore supported and Pages is not ruled out. But what this
repository deploys is not one app's prerendered pages. The composed
`dist/apps/shell` from the build above holds five route documents
(`index.html`, `bio/`, `research/`, `software/`, `courses/`), a `remotes/`
tree with twelve `remoteEntry.js` files totalling 1,547,145 bytes, a `cv-data/`
copy, and `404.html` — assembled from thirteen independently published
subtrees.

What compose does that Start has no counterpart for exists because the document
is assembled from many apps, not because SSR was hand-rolled:

| Compose responsibility | Where |
| --- | --- |
| Rejects cross-app React version skew before assembling | `scripts/compose/compose.mjs:174-204` |
| Substitutes seven Home panes into Home, then Home into the shell route markup | `:233-244`, `:394-403` |
| Normalises React's streamed Suspense boundaries into the DOM React hydrates | `:208-230` |
| Validates the router hydration script's shape per route | `:138-161` |
| Stages every remote's bytes and stamps `data-prerendered-remote` | `:463-483` |
| Copies validated CV data to `cv-data/` and writes the SPA `404.html` | `:451-462` |

`PublishedFragmentPlugin` is likewise only half absorbed: `compileRenderer`
goes, but emitting `fragment.css` with absolutised URLs and `fragment.json`
carrying the React version contract (`libs/build-config/src/published-fragment.ts:199-244`)
has no Start equivalent and stays.

## What the migration costs

**Per app, thirteen times.** Every app's build is a raw rspack config object
consumed by the `@nx/rspack:rspack` executor (`apps/shell/project.json`
`build.options.rspackConfig`; `apps/awards/rspack.config.ts` is two lines
delegating to `remoteConfig`). `tanStackStartRsbuild` returns an `RsbuildPlugin`
(`package/src/rsbuild/plugin.ts:68`) registered through `RsbuildPluginAPI`, so
each `rspack.config.ts` becomes an `rsbuild.config.ts` and the executor changes
with it (`@nx/rsbuild` exists at 23.1.2; this workspace declares `@nx/rspack`
at `package.json:26` and no Rsbuild package). Each app additionally owes the
four entries Start's plan aliases — client, server, start, router
(`package/src/rsbuild/planning.ts:66-86`) — and a generated `src/routeTree.gen.ts`
from either a `src/routes/` directory or a `virtualRouteConfig`
(`package/src/schema.ts:69-79`; the generator is registered unconditionally in
the client environment at `package/src/rsbuild/start-router-plugin.ts:36-63`).
The shell builds its routes in code instead, inside `createSiteRouter`
(`apps/shell/src/router.tsx:75-252`) from `apps/shell/src/routes.json`, so that
whole surface is rewritten. Twelve of the thirteen apps are remotes whose
reason to exist is `exposes`, which Start does not model.

**Workspace-wide.** `@tanstack/react-start@1.168.49` depends on
`@tanstack/react-router@1.170.32` exactly (`package.json:158`), against this
repository's pin of `1.170.18` (`package.json:12`), so adopting Start takes the
router bump out of the repository's hands. `@rsbuild/core ^2.0.0` becomes a real
dependency (declared optional peer at `@tanstack/react-start` `package.json:167-172`
and `@tanstack/start-plugin-core` `package.json:106-114`), and
`@module-federation/enhanced` is swapped for `@module-federation/rsbuild-plugin`.
The Node floor both packages declare — `engines.node: ">=22.12.0"` — is already
met by the 26.5.0 pinned at `.github/workflows/pages.yml:27`.

Everything that reads the artifact's shape moves with it: the artifact gate
`scripts/artifact/check-static-artifact.mjs`, `scripts/compose/compose.spec.ts`,
`apps/shell/e2e/site.spec.ts`, twelve `apps/*/e2e/ownership.spec.ts`, and twelve
`apps/*/visual/baseline/x86_64.json` screencomp baselines. Every rewritten
module owes tests at the 95% floor its project declares (`AGENTS.md`,
"Stack and composition"), and every remote owes its journey through both the
standalone and host-composed boundaries (`AGENTS.md`, "Journeys").

**What is not a cost.** The bundler family is not a blocker, exactly as issue
#92 states: the Rspack family is supported through Rsbuild, which the export
maps confirm — `@tanstack/start-plugin-core` ships `"./rsbuild"`
(`package.json:49-54`) beside `"./vite"`, and `@tanstack/react-start` ships
`"./plugin/rsbuild"` (`package.json:85-90`). Rsbuild sitting above raw Rspack is
what makes this a build-system migration rather than a plugin swap, and that is
where the thirteen-app cost above comes from.

## Recommendation

**Do not schedule it today.**

What Start absorbs is small and already bounded: 77 lines of
`shell-fragment-entry.tsx`, one function in `published-fragment.ts`, and the
head-and-CSS third of a 523-line compose script. What it does not absorb — the
twelve-remote federation split — is where the cost is, and that split is a
stated invariant of `AGENTS.md` ("all 12 remotes must render without failed
assets through both") that issue #92 puts out of scope by decision. So the
migration pays thirteen apps' build-system rewrite to retire the smaller half
of one library, and leaves the larger half standing.

The whole case also rests on one fact neither package answers: that
`tanStackStartRsbuild` and `@module-federation/rsbuild-plugin` coexist in a
single Rsbuild build. Until that is demonstrated, the cost above is a floor
rather than an estimate.

Issue #92's F1a is the cheap alternative and is not foreclosed by deferring
this: adding the missing `router.serverSsr?.cleanup()` and pinning
`@tanstack/router-core` explicitly removes the latent risk that motivates the
SSR half of F1b, and leaves `shell-fragment-entry.tsx` in a state a later Start
migration would delete anyway.

**The condition that would change this recommendation** is a demonstration —
outside this repository, on one app — that a single Rsbuild build runs
`tanStackStartRsbuild` and `@module-federation/rsbuild-plugin` together and
produces both a working federation container with `exposes` and a prerendered
document. With that in hand the analysis above is worth redoing, because the
cost stops being open-ended. Equivalently: if either TanStack package's
published sources gain a Module Federation surface, re-read this record against
that release.

Two things would *not* change it. A further Nx or rspack deprecation is not a
reason: the current build already warns that "the `@nx/rspack:rspack` executor
is deprecated and will be removed in Nx v24", and the migration it names is
`@nx/rspack/plugin` inferred targets, not Rsbuild. Nor is a new Start feature
that improves single-app SSR, since the shell's SSR is not what costs here.
