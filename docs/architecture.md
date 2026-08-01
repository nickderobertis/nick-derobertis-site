# Architecture

## Omnidirectional federation

The site is a static graph of independently built React applications. The
shell owns the Pages base path, shared layout, and browser routes. It consumes
the `home`, `bio`, `research`, `software`, and `courses` route remotes. The
`home` remote is also a host: it composes `home-carousel`, `home-cards`,
`home-story`, `home-contact`, `timeline`, `skills`, and `awards`. Every remote
exposes only `./Page`; the shell additionally exposes `./App`. This makes a
feature testable either inside its parent host or directly at its standalone
URL while preserving route-boundary ownership.

`libs/build-config/src/remotes.json` is the canonical remote registry.
`remoteMap` turns it into project-base URLs, and the compose target uses the
same registry when staging every `remoteEntry.js`. React and React DOM are
singleton federation dependencies. Nx project tags and ESLint prevent feature
domains from reaching into one another: shared libraries may use only shared
libraries, layout may use shared libraries, the shell may use layout and
shared libraries, and remotes may consume shared libraries or explicitly
allowed child remotes.

Startup pays for one route remote, not the graph. The shell resolves only the
page for the route its document was rendered for — the `data-prerendered-route`
attribute the compose step stamps on `#root`, with the pathname as the
fallback — and registers the other four routes as lazy route components, so the
router fetches each container when it preloads that route on hover intent. The
shell therefore also sets the federation `shareStrategy` to `loaded-first`: the
default `version-first` loads every declared remote's `remoteEntry.js` during
share-scope startup to negotiate versions, which no deferral in application code
can avoid. Nothing needs that negotiation here, because React and React DOM are
eager singletons with version checks disabled in every federation config.

The shared-library direction is:

```text
shared libraries -> layout -> shell
        |
        +---------> feature remotes -> declared child remotes
```

`data-access-core` owns schema validation, generated CV contracts, and site
configuration and the versioned published-fragment schema. Each
`data-access-<domain>` library owns only its feature's data
shaping and depends only on the core. Nx module boundaries allow remotes to
import core plus their own domain library and reject cross-domain imports.
`design-system` owns only cross-cutting tokens, the reset, the `.main`
container used by every standalone and host route, and accessibility
primitives. `layout` owns shell header/footer/navigation presentation. Each remote
owns its page and loading-skeleton CSS, so feature styling does not create a
shared dependency edge. The former unused `ui` and `analytics` placeholders
were removed. `build-config` owns federation build configuration. Feature data
hooks may read the staged same-origin JSON, but they validate it through
`data-access-core` before rendering.

## Static hosting and data

The former API is intentionally gone: there is no backend or runtime API. CV data is generated outside this
repository, committed under `libs/data-access-core/vendor/codegen`, and validated at
the core and fragment-build boundaries. Compose copies the validated files
to `cv-data/` in the artifact; browser data requests therefore remain static
same-origin file reads.

Every app build publishes `fragment.html`, `fragment.css`, and `fragment.json`
beside its federated bundle. A remote's HTML and already-absolutized CSS are
produced from that remote's source only. The shell fragment contains the five
shell-owned router frames, their hydration payloads, and named route slots;
Home's fragment similarly contains its `home-main` frame and seven pane slots.
The contract records its schema version, app name, exact React and React DOM
versions, and source revision. Revisions may differ because the artifacts are
independent, but `scripts/compose.mjs` rejects React or React DOM version skew
before writing any route. Publishers stamp `SOURCE_REVISION` when available;
local or container builds that cannot reach Git use the contract-valid
`0000000` sentinel so source metadata never makes a build unavailable.

`shell:prerender` composes a GitHub Pages artifact at `dist/apps/shell` under
the `/nick-derobertis-site/` base from those published bytes. It imports no app
source: it fills the shell and Home slots, normalizes React's completed
Suspense boundaries, emits HTML for all five routes, stages every remote below
`remotes/<name>/`, copies CV data, and creates `404.html`. The
fallback supplies useful no-script recovery text; with JavaScript enabled the
client router restores an unknown deep link to the home route. GitHub Actions
uploads this directory directly to Pages. The custom domain is intentionally
outside this deployment until its separate migration.

Page CSS ships with each remote's federated JavaScript, so every route document
also inlines the published fragment CSS of the remotes whose markup it composes — Home
inlines its own plus the seven panes it composes — ahead of the deferred
scripts. Without that, the prerendered content would paint unstyled until
roughly a megabyte of JavaScript arrived. Each app build rewrites relative
`url()` targets against its own public path; compose maps routes to fragments
and deduplicates identical payloads. `scripts/check-static-artifact.mjs` runs
after assembly and fails when a route stamp or required inlined CSS is absent.

The byte comparison against the former source renderer found three intentional
differences. Router hydration timestamps reflect the independent shell build
rather than compose time, and React's server-timing `requestAnimationFrame`
probe is absent where async feature markup was rendered by its owning remote
instead of inside the shell render. React-generated form-control IDs on Home
also use each pane fragment's own render namespace instead of the former
shell-wide namespace; each matching `for`/`id` pair remains intact. None of
these differences changes application DOM semantics or hydration state; the
browser suite verifies that all five documents reuse their DOM without
hydration warnings. Route markup, substantive content, CSS, router payloads,
staging, CV data, and fallback behavior are otherwise equivalent.

## Affected-only economics

Pull-request gates use Nx's dependency graph between `NX_BASE` and `NX_HEAD`.
They run expensive build, prerender, e2e, and screenshot work only where a
change can have an effect, while always running the shell-wide integration
suite. Pushes to `master` add `check-all`, so affected selection is an
optimization rather than the only safety net.

The measured integration review is recorded in
[integration-proof.md](integration-proof.md). Its `nx affected --files` proof
showed that a design-system change selected all 12 dependent remotes, an Awards
page change selects only `awards:build` and no prerender target, and domain/core data changes preserve
the isolation documented there. In the Skills case, 25 browser
tests passed and only one e2e target ran; the remaining 14 tasks were required
static build/prerender dependencies. The shell integration target separately
protects navigation, direct routes, static markup, fallback recovery, and the
cross-remote state matrix.
