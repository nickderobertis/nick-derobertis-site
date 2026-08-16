# Microfrontend integration proof

The commands below were run from the repository root on 2026-07-21. The single
remote change, the Awards selection, and the awards shaping change were re-run
on 2026-08-16, when `apps/shell`'s lint target took on the key covering every
file its workspace-wide eslint run reads. Nx's
`--files` mode supplies the named changed file directly, avoiding an artificial
commit while exercising the same affected-project graph used by `--base` and
`--head`.

## Shared design-system change

```console
$ just e2e-affected-files libs/design-system/src/theme.css
["home-carousel","home-contact","home-cards","home-story","research","software","timeline","courses","awards","skills","home","bio"]
 NX   Running target e2e for 12 projects and 14 tasks they depend on:

- home-carousel
- home-contact
- home-cards
- home-story
- research
- software
- timeline
- courses
- awards
- skills
- home
- bio

 NX   Successfully ran target e2e for 12 projects and 14 tasks they depend on

  Run duration:      5m 26s
  Cache:             13/26 hit (50%)
  Critical path:     2m 38s (3 tasks)
  Recoverable time:  2m 48s (52% of the run)
```

Those are the twelve remotes that import the design system, directly or through
the data-access library. No unrelated library or shell integration project has
an `e2e` target in this selection.

## Single remote change

```console
$ just e2e-affected-files apps/skills/src/page.tsx
["skills","shell"]
Running 27 tests using 1 worker
  ✓  renders through its host-composed boundary
  ✓  renders through its standalone boundary
  ✓  host-composed renders the recursive skills tree
  ✓  host-composed reveals stats on hover and keyboard focus
  27 passed (41.4s)

Running 46 tests using 1 worker
  46 passed (1.7m)

 NX   Successfully ran target e2e for 2 projects and 14 tasks they depend on

  Run duration:      2m 26s
  Cache:             0/16 hit (0%)
  Critical path:     1m 54s (3 tasks)
  Recoverable time:  32.0s (22% of the run)
```

The dependent tasks are the fixed static-site build and prerender prerequisites.
No other remote's journey runs. The shell's does, because the shell owns the
workspace's single `eslint .` run and its `lint` target is therefore keyed on
every TypeScript file in the tree; Nx marks a project affected rather than a
target, so selecting that lint selects the shell. `just check` runs `shell:e2e`
outright anyway, so nothing is spent there that the gate was not already
spending.

After composition moved to published artifacts, an Awards-only source change
selects no unrelated application build. It does select the shell, for a reason
that has nothing to do with the shell's own bytes: the shell owns the
workspace's single `eslint .` run, whose cache key covers every TypeScript file
in the tree, and Nx marks a project affected rather than a target. That
selection is what makes the boundary rules see the edit; the shell's own build
replays from cache, because none of its inputs moved.

```console
$ pnpm exec nx show projects --affected --files=apps/awards/src/page.tsx --with-target=build --json
["awards","shell"]

$ pnpm exec nx show projects --affected --files=apps/awards/src/page.tsx --with-target=prerender --json
["shell"]
```

## Split data-access dependency economics

```console
$ just affected-build-projects libs/data-access-awards/src/awards.ts
["data-access-awards","awards","shell"]

$ just affected-build-projects libs/data-access-core/src/client.ts
["data-access-core","data-access-research","research","data-access-software","software","data-access-timeline","timeline","data-access-courses","courses","data-access-awards","awards","data-access-skills","skills","data-access-home","home-carousel","home-contact","home-cards","home-story","home","build-config","artifact-contracts","visual-harness","bio","shell"]
```

An awards shaping change selects only the awards library and remote, plus the
shell that carries the workspace-wide eslint run. A core
client change fans out to every CV-backed feature and all Home composition
remotes, and on through `@site/build-config`, whose federation entry reads that
client, to the build libraries and Bio — the one remote with no CV or
site-config data of its own, which is reached by its rspack configuration
rather than by its content. The shell-wide route, keyboard, fallback, and state
matrix remains the explicit `shell:e2e` target run by `just check`.

## Static Pages and visual evidence

`shell:prerender` writes each route beneath `/nick-derobertis-site/`, stages
every remote from the canonical manifest beneath `remotes/<name>/remoteEntry.js`,
and writes `404.html`. The JavaScript-disabled browser assertion checks real
feature text on all five routes, while the integration suite checks deep-link
recovery and omnidirectional host/remote composition.

Visual regression is now screencomp's canonical reusable workflow
(`.github/workflows/visual-docs.yml`). Capture runs inside the pinned Linux
container the reusable workflow uses; the Nx `screenshot` target builds each
microfrontend with its composed shell/home remotes and writes
`$SHOTS_OUT/captures.json` plus its PNGs. Determinism is proven by capturing an
affected app fresh in that container and classifying it against the committed,
image-free baseline manifest — a byte-digest comparison, so a one-pixel layout,
content, or color change fails:

The reusable workflow publishes galleries to the dedicated visual-docs Pages
site one directory per project — canonical galleries for the default branch at
`https://nickderobertis.github.io/nick-derobertis-site-visual-docs/<project>/x86_64/`
and pull-request previews at
`https://nickderobertis.github.io/nick-derobertis-site-visual-docs/pr-<number>/<project>/x86_64/`.
No root index is written, and only affected projects are deployed. The
aggregated pull-request comment — which also carries inline before/after diffs
when the change set is small — holds the direct links and is the intended entry
point. This repository cannot serve galleries from its own
`gh-pages` branch: its production Pages site uses an Actions artifact
deployment, so GitHub serves that artifact rather than the branch. Keeping the
gallery branch in a separate repository preserves the production deployment.

```console
$ docker run --rm --platform=linux/amd64 --ipc=host --shm-size=2g \
    -v "$PWD:/work" -v /work/node_modules -w /work \
    -e SCREENCOMP_PROJECT=bio -e SHOTS_OUT=shots/current/bio/x86_64 \
    mcr.microsoft.com/playwright:v1.61.1-noble \
    bash -lc 'corepack enable && pnpm install --frozen-lockfile && pnpm exec nx run bio:screenshot'
$ screencomp classify --baseline-manifest apps/bio/visual/baseline/x86_64.json \
    --current shots/current/bio --arch x86_64 --exit-code
added 0 changed 0 removed 0 unchanged 12
```

A fresh container capture matching the previously committed baseline
byte-for-byte demonstrates cross-environment reproducibility directly (the
baseline and this capture were produced by different runs), so no same-CPU
baseline reconstruction is needed. In CI the reusable workflow re-runs the
capture into a second tree for the reproducibility gate, then classifies each
affected app against its own baseline; drift fails the `classify-gate` check.

Affected-only economics are preserved by the upstream `affected` job. A
single-remote edit selects only that microfrontend, and a shared design-system
edit selects exactly its dependents, each becoming one `projects` lane:

```console
$ nx show projects --affected --files apps/skills/src/page.tsx --with-target screenshot --json \
    | node scripts/visual/affected-visual-projects.mjs
[{"id":"skills","current":"shots/current/skills","verify":"shots/verify/skills","manifest":"apps/skills/visual/baseline/x86_64.json","gallery-title":"skills"}]

$ nx show projects --affected --files libs/design-system/src/theme.css --with-target screenshot --json \
    | node scripts/visual/affected-visual-projects.mjs
# → 12 lanes: awards, bio, courses, home, home-cards, home-carousel,
#   home-contact, home-story, research, skills, software, timeline
```

`scripts/visual/visual-affected.spec.ts` locks both cases in.
