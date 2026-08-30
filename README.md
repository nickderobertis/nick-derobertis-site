# Nick DeRobertis site

Nick DeRobertis's static professional site, built as an Nx monorepo with React,
rspack, and Module Federation. It is published at
<https://nickderobertis.github.io/nick-derobertis-site/>. The custom domain
continues to use the legacy AWS deployment until it is migrated separately.

## Local development

Install Node 26 and [`just`](https://just.systems/), then bootstrap the pinned
pnpm workspace:

```bash
just bootstrap
```

Develop one app against the rest of the graph:

```bash
just serve-dev shell     # the shell and its routes, from source
just serve-dev awards    # one pane, from source
```

Reach for this while you are writing code. It builds the complete artifact
once, then serves the app you named from source with hot module replacement
while every other app is answered for out of that build, all on one origin at
the Pages base path. Editing a source file of the app under development updates
the running page — no workspace rebuild, no restart. It listens on the address
`nx.json` gives every `serve` target, which is the one `just serve` uses below,
and answers there for the shell and for each standalone pane alike; either way
the shell's routes resolve across the mix. `PORT` moves the server off that
port, and an app name the workspace cannot serve is refused before anything is
built.

Reach for the production-shaped path when you want the artifact rather than the
source — the bytes GitHub Pages serves, prerendered and composed:

```bash
just serve
```

Open <http://127.0.0.1:4200/nick-derobertis-site/>. The recipe rebuilds and
prerenders the complete static artifact before serving it, so restart it after
source changes. Press Ctrl-C in its terminal to stop the server. Standalone
remotes are available at
`http://127.0.0.1:4200/nick-derobertis-site/remotes/<remote>/`.

## Test and build

`just check` is the complete pre-push gate. It formats-checks the workspace,
lints workflows and shell scripts, and runs affected lint, typecheck, unit,
build, prerender, browser, and visual targets plus the complete shell browser
integration suite.

```bash
just check
```

Useful focused commands are:

```bash
just test                 # affected unit and browser tests
just test-e2e             # complete shell browser journeys
just e2e-project skills   # one remote, standalone and host-composed
just prerender            # build every app, then compose dist/apps/shell
just compose store out    # compose only, from already-published fragments
just serve                # the composed production artifact, served
just serve-dev <app>      # one app from source with hot module replacement
just lint                 # all-project lint and typecheck
just format               # apply Biome formatting
```

Set `NX_BASE` and `NX_HEAD` to override the affected range used by `just check`
and `just test`. CI runs `just check-all` on `master` as a non-affected safety
sweep. See [the architecture](docs/architecture.md) for project boundaries,
hosting, and affected-test behavior.

Pull requests with affected visual projects get one aggregated screencomp
comment with real before/after diffs and direct gallery links; that comment is
the intended entry point. Galleries are published per project, not at a site
root — there is no index page:

- canonical (`master`):
  `https://nickderobertis.github.io/nick-derobertis-site-visual-docs/<project>/x86_64/`
- pull-request preview:
  `https://nickderobertis.github.io/nick-derobertis-site-visual-docs/pr-<number>/<project>/x86_64/`

Only affected projects are captured and deployed, so a project has a gallery
only once it has been affected; previews are pruned when the pull request
closes. The galleries use a dedicated Pages repository because this
repository's production Pages site is deployed from an Actions artifact; GitHub
therefore does not serve its `gh-pages` branch, even when screencomp writes
galleries there.

## Deployment performance

Run the network-dependent Lighthouse comparison separately from the deterministic
quality gate:

```bash
just perf
just perf https://representative-host.example/ 5
just perf-compare
just perf-compare https://new.example/ https://original.example/ 7
```

Both recipes audit `/`, `/bio`, `/research`, `/software`, and `/courses` on the
target and original deployments. `perf` is shorthand for comparing an
overridden target to the default original URL; `perf-compare` overrides either
side explicitly. At least `5` runs are required. The runner uses Lighthouse's
explicit `desktop` preset (desktop form factor and desktop simulated
throttling), reports median metrics, records the applied throttling and host
environment, and writes structured findings to `docs/perf-findings.json` plus
the readable `docs/perf-report.md`. It uses the pinned Playwright Chromium by
default; set `CHROME_PATH` to audit with another representative Chrome binary.
Successful recipes print one summary line and leave the complete planner-facing
structured findings in `docs/perf-findings.json`.

`performance.config.json` is the source of truth for routes, defaults, and the
minimum sample count. The deterministic test gate validates both Lighthouse
input shapes and that `docs/perf-report.md` is an exact rendering of
`docs/perf-findings.json`. After intentionally editing structured findings,
refresh and verify the readable artifact with:

```bash
just perf-refresh-report
just perf-check-report
```

Absolute timings depend on the machine and live network path, so use the same
representative host for meaningful timing comparisons. Transfer-byte and CLS
deltas are less environment-sensitive. These recipes are intentionally absent
from `just check` because they contact public deployments.

## Deploy

Pushes to `master` run the full CI gate and the `pages.yml` workflow. That
workflow deploys each app independently: one publish lane per affected app
builds only that app and writes only its own `apps/<app>/` subtree to the
`published-fragments` content-store branch, and a single serialized lane runs
`just compose .content-store/apps dist/site` over whatever that branch holds
before uploading it to GitHub Pages. Nothing in the deploy lane builds an app.
`workflow_dispatch` republishes every lane, which is how a content store that
has never held a full set of fragments is seeded.

The content-store branch is storage only and is never the served source: Pages
stays on `build_type: workflow`, because the artifact deploy avoids the legacy
branch builder's newer-build-kills-in-flight-build race. There is no runtime
server or API to provision.
