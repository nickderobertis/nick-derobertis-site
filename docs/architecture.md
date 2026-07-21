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
`remoteMap` turns it into project-base URLs, and the prerender target uses the
same registry when staging every `remoteEntry.js`. React and React DOM are
singleton federation dependencies. Nx project tags and ESLint prevent feature
domains from reaching into one another: shared libraries may use only shared
libraries, layout may use shared libraries, the shell may use layout and
shared libraries, and remotes may consume shared libraries or explicitly
allowed child remotes.

The shared-library direction is:

```text
shared libraries -> layout -> shell
        |
        +---------> feature remotes -> declared child remotes
```

`data-access` owns schema validation and data shaping, `design-system` owns the
visual foundation, `ui` owns reusable components, `analytics` owns browser
analytics, and `build-config` owns federation build configuration. Feature data
hooks may read the staged same-origin JSON, but they validate it through
`data-access` before rendering.

## Static hosting and data

The former API is intentionally gone: there is no backend or runtime API. CV data is generated outside this
repository, committed under `libs/data-access/vendor/codegen`, and validated at
the data-access and prerender boundaries. Prerender copies the validated files
to `cv-data/` in the artifact; browser data requests therefore remain static
same-origin file reads.

`shell:prerender` builds a GitHub Pages artifact at `dist/apps/shell` under the
`/nick-derobertis-site/` base. It emits HTML for all five routes, stages every
remote below `remotes/<name>/`, copies CV data, and creates `404.html`. The
fallback supplies useful no-script recovery text; with JavaScript enabled the
client router restores an unknown deep link to the home route. GitHub Actions
uploads this directory directly to Pages. The custom domain is intentionally
outside this deployment until its separate migration.

## Affected-only economics

Pull-request gates use Nx's dependency graph between `NX_BASE` and `NX_HEAD`.
They run expensive build, prerender, e2e, and screenshot work only where a
change can have an effect, while always running the shell-wide integration
suite. Pushes to `master` add `check-all`, so affected selection is an
optimization rather than the only safety net.

The measured integration review is recorded in
[integration-proof.md](integration-proof.md). Its `nx affected --files` proof
showed that a design-system change selected all 12 dependent remotes, a Skills
page change selected only `skills:e2e`, and a data-access change selected the
10 consumers while excluding `home` and `bio`. In the Skills case, 25 browser
tests passed and only one e2e target ran; the remaining 14 tasks were required
static build/prerender dependencies. The shell integration target separately
protects navigation, direct routes, static markup, fallback recovery, and the
cross-remote state matrix.
