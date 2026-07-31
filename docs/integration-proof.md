# Microfrontend integration proof

The commands below were run from the repository root on 2026-07-21. Nx's
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
["skills"]
Running 25 tests using 1 worker
  ✓  skills renders through its host-composed boundary
  ✓  skills renders through its standalone boundary
  ✓  host-composed presents its empty, loading, and error states
  ✓  standalone remote presents its empty, loading, and error states
  25 passed (23.6s)

 NX   Successfully ran target e2e for project skills and 14 tasks it depends on

  Run duration:      1m 10s
  Cache:             1/15 hit (7%)
  Critical path:     36.6s (3 tasks)
  Recoverable time:  33.3s (48% of the run)
```

The dependent tasks are the fixed static-site build and prerender prerequisites;
the only executed e2e target is `skills:e2e`.

After composition moved to published artifacts, an Awards-only source change
no longer selects the shell prerender or any unrelated application build:

```console
$ pnpm exec nx show projects --affected --files=apps/awards/src/page.tsx --with-target=build --json
["awards"]

$ pnpm exec nx show projects --affected --files=apps/awards/src/page.tsx --with-target=prerender --json
[]
```

## Split data-access dependency economics

```console
$ just affected-build-projects libs/data-access-awards/src/awards.ts
["data-access-awards","awards"]

$ just affected-build-projects libs/data-access-core/src/client.ts
["data-access-core","data-access-research","research","data-access-software","software","data-access-timeline","timeline","data-access-courses","courses","data-access-awards","awards","data-access-skills","skills","data-access-home","home","home-carousel","home-contact","home-cards","home-story"]
```

An awards shaping change selects only the awards library and remote. A core
client change fans out to every CV-backed feature and all Home composition
remotes. Bio is correctly absent because it has no CV or site-config dependency.
The shell-wide route, keyboard, fallback, and state matrix remains the explicit
`shell-e2e:integration` target run by `just check`.

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
    | node scripts/affected-visual-projects.mjs
[{"id":"skills","current":"shots/current/skills","verify":"shots/verify/skills","manifest":"apps/skills/visual/baseline/x86_64.json","gallery-title":"skills"}]

$ nx show projects --affected --files libs/design-system/src/theme.css --with-target screenshot --json \
    | node scripts/affected-visual-projects.mjs
# → 12 lanes: awards, bio, courses, home, home-cards, home-carousel,
#   home-contact, home-story, research, skills, software, timeline
```

`apps/shell-e2e/src/unit/visual-affected.spec.ts` locks both cases in.
