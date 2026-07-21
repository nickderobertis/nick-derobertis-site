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

Run the complete shell and federated graph through the supported local browser
harness:

```bash
just test-e2e
```

It builds and prerenders the artifact, starts the static server, and exercises
the real site. Routes live below the project base `/nick-derobertis-site/`;
each remote is also exercised below `/nick-derobertis-site/remotes/<remote>/`
for standalone development and tests. Use `just e2e-project <remote>` for a
focused iteration loop.

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
just lint                 # all-project lint and typecheck
just format               # apply Biome formatting
```

Set `NX_BASE` and `NX_HEAD` to override the affected range used by `just check`
and `just test`. CI runs `just check-all` on `master` as a non-affected safety
sweep. See [the architecture](docs/architecture.md) for project boundaries,
hosting, and affected-test behavior.

## Deploy

Pushes to `master` run the full CI gate and the `pages.yml` workflow. That
workflow installs the locked dependencies, runs `shell:prerender`, uploads
`dist/apps/shell`, and deploys it with GitHub Pages. `workflow_dispatch` can
rerun the same deployment manually. There is no runtime server or API to
provision.
