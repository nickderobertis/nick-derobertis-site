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

Start the complete shell and federated graph for interactive development:

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
just prerender            # static artifact in dist/apps/shell
just serve                # interactive static development server
just lint                 # all-project lint and typecheck
just format               # apply Biome formatting
```

Set `NX_BASE` and `NX_HEAD` to override the affected range used by `just check`
and `just test`. CI runs `just check-all` on `master` as a non-affected safety
sweep. See [the architecture](docs/architecture.md) for project boundaries,
hosting, and affected-test behavior.

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
Successful recipes print one summary line; set `PERF_FINDINGS_STDOUT=1` when a
caller needs the complete structured findings on standard output as well.

`performance.config.json` is the source of truth for routes, defaults, and the
minimum sample count. The deterministic test gate validates both Lighthouse
input shapes and that `docs/perf-report.md` is an exact rendering of
`docs/perf-findings.json`. After intentionally editing structured findings,
refresh and verify the readable artifact with:

```bash
node scripts/performance-audit.mjs --refresh-report
node scripts/performance-audit.mjs --check-report
```

Absolute timings depend on the machine and live network path, so use the same
representative host for meaningful timing comparisons. Transfer-byte and CLS
deltas are less environment-sensitive. These recipes are intentionally absent
from `just check` because they contact public deployments.

## Deploy

Pushes to `master` run the full CI gate and the `pages.yml` workflow. That
workflow installs the locked dependencies, runs `shell:prerender`, uploads
`dist/apps/shell`, and deploys it with GitHub Pages. `workflow_dispatch` can
rerun the same deployment manually. There is no runtime server or API to
provision.
