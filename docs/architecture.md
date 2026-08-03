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

`scripts/compose.mjs` assembles a GitHub Pages artifact under the
`/nick-derobertis-site/` base from those published bytes. It imports no app
source: it stages the shell's bundle at the artifact root, fills the shell and
Home slots, normalizes React's completed Suspense boundaries, emits HTML for
all five routes, stages every remote below `remotes/<name>/`, copies CV data,
and creates `404.html`. Staging copies each app's published bytes verbatim
except `fragment.html`, `fragment.css`, and `fragment.json`, which are
compose's own inputs and mean nothing to a browser, and except the entries
compose writes itself at the artifact root — `index.html`, `404.html`,
`cv-data/`, `remotes/`, and the four route directories — which the shell's
subtree must never supply, because the local shortcut composes into that same
directory. `check-static-artifact.mjs` then resolves every `<script src>` and
`<link rel="stylesheet">` in every composed document the way the browser does,
through the document's `<base href>` and the Pages base path, and refuses an
artifact that references bytes it does not contain. The
fallback supplies useful no-script recovery text; with JavaScript enabled the
client router restores an unknown deep link to the home route. `just compose
<store>/apps <output>` runs it plus `check-static-artifact.mjs` over an
already-published content store; `just prerender` is the local shortcut that
builds every app first and composes into `dist/apps/shell`, which is what
`just serve` and the browser suites use. The custom domain is intentionally
outside this deployment until its separate migration.

## Independent publishing and one composed deploy

Under GitHub Pages a deployed artifact is always the whole site, so
independent deployability comes from splitting *publishing an app's bytes* from
*assembling and deploying the site*. `.github/workflows/pages.yml` has three
stages and builds no app it does not have to:

```text
affected: just publish-lanes <before> <sha>   (just publish-lanes seeds every lane)
  -> publish lane per app (matrix, fail-fast: false)
       just build-app <app>  ->  just publish-fragment
                                   -> apps/<app>/ on the content-store branch
  -> deploy (one serialized lane)
       just compose .content-store/apps dist/site -> upload-pages-artifact -> deploy-pages
```

`libs/build-config/src/publish-fragment.ts` owns a lane's whole contract, and
it is the one source for the names that contract is stated in: the
`published-fragments` content-store branch, the `.content-store` working copy
the deploy lane checks it out into, and the `.publish-store` scratch repository
a lane pushes from. The workflow, the ignore rules, and these documents all
restate those names, so `scripts/verify-content-store-contract.mjs` — run by
`just lint-workflows` — holds every restatement to them. A lane
re-reads the branch tip, replaces only `apps/<app>/`, and refuses to commit any
staged path outside that subtree or the root notice, so a lane can never revert
another lane's bytes. Concurrent lanes race for the tip, so a rejected
non-fast-forward push is expected rather than exceptional: the lane re-syncs to
the winner's tip and re-applies its own subtree, up to `PUBLISH_ATTEMPTS` times.
Compose is idempotent full state — it always assembles every app's currently
published bytes — so a superseded compose run loses nothing and the next one
publishes everything. Publish lanes carry revisions independently, which is why
compose tolerates revision skew while still rejecting React version skew.

**The content-store branch is storage and must never become the served
source.** Pages for this repository stays on `build_type: workflow`. The
artifact deploy is what avoids the legacy Pages branch builder, where a newer
build kills an in-flight one and records it `errored` with duration 0, and it is
why the 10-builds-per-hour soft limit does not apply. Serving the branch would
also publish unassembled per-app fragments rather than a site.
`validatedBranch` rejects `master`, `main`, and `gh-pages` outright.

The compose-and-deploy job declares `concurrency: {group: pages-compose-deploy,
queue: max, cancel-in-progress: false}`. The default `queue: single` keeps at
most one pending run and cancels it when a third arrives, which would silently
drop the deploys of every app published in between; `queue: max` queues up to
100 runs in FIFO order instead. `queue: max` with `cancel-in-progress: true` is
a workflow validation error. The actionlint release pinned in `ci-tools.json`
predates the `queue` key, so `.github/actionlint.yaml` ignores exactly that one
message in exactly that one file.

Nothing a lane builds may require git to be reachable: `SOURCE_REVISION` is
stamped by the caller and falls back to the `0000000` sentinel, because the
visual-capture container mounts only the worktree. A push to `master` publishes
only affected apps; a manual `workflow_dispatch` republishes every lane, which
is how a content store that has never held a full set of fragments is seeded,
since compose refuses to assemble a partial site.

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
