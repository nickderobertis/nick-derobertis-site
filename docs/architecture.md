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

A remote is defined by its own project. `apps/<remote>/project.json` declares
`metadata.federation.alias` — the Module Federation container it publishes
under — and `metadata.boundaries.onlyDependOnLibsWithTags` — the library tags
its scope admits. `apps/shell` declares neither: it is the host, not a remote.
Everything that used to restate that list in a root file is derived from those
declarations. `scripts/workspace/federation-plugin.mjs`, registered in
`nx.json`, sets each remote's `screenshot.dependsOn` and the shell's
`prerender.dependsOn`, so every remote's build stays a prerequisite of the
composed site and of every capture. `eslint.config.mjs` maps the same
declarations into its `scope:<app>` boundary constraints.

`libs/build-config/src/remotes.json` is the canonical remote registry, and it is
generated from the project graph by `just generate-remote-registry`; five run-time
consumers read it as a file, so it stays one, and `just lint-workflows` fails
when what is committed disagrees with what the graph declares.
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
`design-system` owns cross-cutting tokens, the reset, the `.main`
container used by every standalone and host route, accessibility
primitives, and the shared UI primitives every remote composes its pages
from — the page shell, the section heading, the card, the action link, the
pane state, and the loading skeleton — each published as a React component
beside the one rule that paints it, parameterised through `--card-*`,
`--title-*`, `--action-*` and `--eyebrow-*` custom properties so a pane that
looks different sets a token instead of restating the primitive. `layout` owns
shell header/footer/navigation presentation. Each remote owns the page CSS that
is genuinely its own, so feature styling does not create a shared dependency
edge; every remote already depends on `design-system`, so adopting a primitive
adds no edge either. The former unused `ui` and `analytics` placeholders
were removed. `build-config` owns federation build configuration, which every
app's rspack config imports; `publish-config` owns the content-store publish
path, which only workspace tooling imports, so an edit to a publish lane never
reaches an app build. Feature data
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
independent, but `scripts/compose/compose.mjs` rejects React or React DOM version skew
before writing any route. Publishers stamp `SOURCE_REVISION` when available;
local or container builds that cannot reach Git use the contract-valid
`0000000` sentinel so source metadata never makes a build unavailable.

`scripts/compose/compose.mjs` assembles a GitHub Pages artifact under the
`/nick-derobertis-site/` base from those published bytes. It imports no app
source: it fills the shell and Home slots, normalizes React's completed
Suspense boundaries, emits HTML for all five routes, stages every remote below
`remotes/<name>/`, copies CV data, and creates `404.html`. The
fallback supplies useful no-script recovery text; with JavaScript enabled the
client router restores an unknown deep link to the home route. `just compose
<store>/apps <output>` runs it plus `check-static-artifact.mjs` over an
already-published content store; `just prerender` is the local shortcut that
builds every app first and composes into `dist/apps/shell`, which is what
`just serve` and the browser suites use. The custom domain is intentionally
outside this deployment until its separate migration.

Staging is what puts an app's bytes into the artifact — the shell's build
output at the root, each remote's below `remotes/<name>/` — copied verbatim
except `fragment.html`, `fragment.css`, and `fragment.json`, which are
compose's own inputs and mean nothing to a browser. From the shell's subtree
compose additionally withholds every entry it writes itself, the route
directories and `404.html` and `cv-data/` and `remotes/`, because `just
prerender` composes into that same directory: a shell published from a
developer's tree carries a whole previous composition beside its bundle.
`check-static-artifact.mjs` then resolves every `<script src>` and `<link
rel="stylesheet">` in every composed document the way the browser does, through
the document's `<base href>` and the Pages base path, and refuses an artifact
that references bytes it does not contain — which a document whose bundle was
never staged does.

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

`libs/publish-config/src/publish-fragment.ts` owns a lane's whole contract, and
it is the one source for the names that contract is stated in: the
`published-fragments` content-store branch, the `.content-store` working copy
the deploy lane checks it out into, and the `.publish-store` scratch repository
a lane pushes from. The workflow, the ignore rules, and these documents all
restate those names, so `scripts/publish/verify-content-store-contract.mjs` — run by
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
and deduplicates identical payloads. `scripts/artifact/check-static-artifact.mjs` runs
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
page change selects no unrelated remote's build, and domain/core data changes preserve
the isolation documented there. In the Skills case, 27 browser
tests passed and no other remote's journey ran; the remaining 14 tasks were required
static build/prerender dependencies. The shell integration target separately
protects navigation, direct routes, static markup, fallback recovery, and the
cross-remote state matrix.

Any TypeScript change selects the shell as well, because the shell owns the
workspace's single `eslint .` run: that target is keyed on every file the
command reads, and Nx marks a project affected rather than a target. Keyed on
`apps/shell` alone it would replay a cached pass for rules and files no run had
seen, so the selection is the point rather than a cost — the shell's own cached
work replays, and `just check` runs `shell:e2e` outright in any case.

What a cached target is keyed on is otherwise kept to what its command reads:
`biome.json` keys `lint` alone rather than every project's build, test, and
typecheck, and the gate never passes `--skip-nx-cache`, so the builds beneath
its e2e and screenshot targets replay. `scripts/workspace/cache-keying.spec.ts`
holds both to the graph Nx resolves.

## Workspace tooling projects

<!-- llmlint: ignore-block[contracts_have_one_source_or_a_drift_gate] This human-readable ownership map intentionally names the projects; module-boundaries.spec.ts verifies their tags and targets against the Nx graph. -->
`scripts/` is eight Nx projects rather than a folder of loose files, one per
tooling concern: `tooling-compose`, `tooling-artifact`, `tooling-publish`,
`tooling-visual`, `tooling-perf`, `tooling-serve`, `tooling-ci`, and
`tooling-workspace`. Each owns its CLIs and the specs that drive them, so Nx
selects a tooling change the way it selects an app change, and a spec about the
publish lanes no longer waits on a thirteen-app federation build to run.
`tooling-artifact` is the only one whose `test` target depends on
`shell:prerender`, because its specs read the assembled artifact. The
real-browser performance audit needs that artifact too, so it runs as
`tooling-perf`'s `e2e` target — declaring the same prerender dependency the app
journeys declare, since `dist/apps/shell` is also `shell:build`'s output
directory and a cached build restored into it leaves nothing composed behind —
alongside the other Playwright journeys rather than holding up that project's
own tests.
<!-- llmlint: ignore-end[contracts_have_one_source_or_a_drift_gate] -->

No file in `scripts/` imports another one. What two CLIs share lives in a
library instead: `@site/artifact-contracts` parses the serialized route and
remote contracts for both compose and the artifact gate, and
`@site/e2e-fixtures` owns the Pages-base static server and the CV-data
scenarios that the e2e server and the visual capture host both serve through.

Every app owns its Playwright suite, so the facts more than one suite asserts
live in `@site/e2e-harness`: the route inventory, each remote's accessible
landmark and loading status, and the panes Home composes. The harness joins
each of them to the manifest that publishes it — `apps/shell/src/routes.json`,
`libs/build-config/src/remotes.json`, and the composition
`apps/home/rspack.config.ts` declares — and fails by name when the two
disagree, so a new route or pane cannot ship without the journeys that cover
it.

## Test harness libraries

Splitting one suite per app multiplies the number of places a testing decision
is made, so each decision has exactly one library that owns it and each app
declares only what is its own.

`@site/e2e-harness` owns the Playwright side. `defineAppE2eConfig` builds an
app's whole configuration from its project name and port — the test directory,
the Pages-base URL, the `serve-e2e.mjs` web server, the retry and trace policy —
so `apps/<app>/e2e/playwright.config.ts` is one call rather than thirteen
copies of a policy that can drift. `remoteOwnershipTests` registers the
federation journeys every remote owes, and `homePaneJourneys` registers the
happy, skeleton, empty, error, and breakpoint journeys every Home pane owes, in
both render paths; the seven pane suites are a single call each.

`@site/testing` owns the Vitest side. `defineWorkspaceTestConfig` builds a
project's whole Vitest configuration from its name and directory — the jsdom
environment, the shared setup file, the spec glob, and the coverage report —
and validates the floor that project states, so each component config is one
call rather than a harness copied per project. Workspace specifiers need no
alias here: every project publishes itself as a package, so Vitest resolves
`@site/*` through Node the way every other consumer does. A host
passes the federation specifiers its component tests must resolve — Home points
each at the sibling app's real source, and the shell at the stand-ins under
`apps/shell/test-remotes` — because Vitest has no Module Federation runtime.

`@site/visual-harness` owns capture. `captureVisualSuite` serves the artifact
each app's shots are taken from, confines its writes to that project's own
`shots/` roots, drives each scenario's viewport, state, and render path, and
writes the `captures.json` screencomp classifies; `standardVisualScenarios`
builds the scenario set every app shares from that app's own states, queries,
and target locators. `apps/<app>/visual/scenarios.ts` therefore declares only
what is particular to that app, and `capture.ts` beside it is one call.

`@site/e2e-fixtures` sits under both: it owns the Pages-base static server and
the CV-data scenario steering that the Playwright web server and the visual
capture host both serve through, so a `?scenario=` state means the same thing
in a journey and in a screenshot.

`scripts/workspace/structure-contract.spec.ts` holds the whole arrangement
together. It derives its subjects from the Nx project graph, the justfile, and
the hook directory, and fails when an app has no `vite.config.ts`, no `e2e/`
with its own Playwright config, or no `visual/scenarios.ts` for a `screenshot`
target; when a `test` target passes `--passWithNoTests`, names no Vitest config,
or declares a floor below 95 on any metric; when a project holds specs no target
runs; when a component ships with no co-located spec; or when a workspace
script, `just` recipe, or hook is driven by no tooling spec and records no
reason it cannot be.
