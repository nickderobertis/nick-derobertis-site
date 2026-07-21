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

## Data-access dependency example

```console
$ just e2e-affected-files libs/data-access/src/site.ts
["home-carousel","home-contact","home-cards","home-story","research","software","timeline","courses","awards","skills"]
```

`home` and `bio` are correctly absent because they do not import data-access.
The shell-wide route, keyboard, fallback, and state matrix remains the explicit
`shell-e2e:integration` target run by `just check`; it is deliberately separate
from affected remote ownership.

## Static Pages and visual evidence

`shell:prerender` writes each route beneath `/nick-derobertis-site/`, stages
every remote from the canonical manifest beneath `remotes/<name>/remoteEntry.js`,
and writes `404.html`. The JavaScript-disabled browser assertion checks real
feature text on all five routes, while the integration suite checks deep-link
recovery and omnidirectional host/remote composition.

The pinned visual command prefers Docker. When Docker is unavailable, it
reconstructs the commit that introduced each baseline manifest, captures that
revision and the current revision with the same local Chromium/CPU, and requires
the two capture sets to be byte-identical. This removes CPU rasterization as a
variable without adding a pixel threshold: a one-pixel layout, content, or color
change still fails.

```console
$ just visual-project bio
visual-project: bio matches the baseline source commit byte-for-byte on this CPU; manifest drift is rasterization-only
```

Exact per-route results from the normal, unmodified targets:

| Route | Current recapture | Same-CPU baseline commit | Result |
| --- | ---: | ---: | --- |
| Home | 12/12 byte-identical | 12/12 byte-identical | Pass |
| Bio | 12/12 byte-identical | 12/12 byte-identical | Pass |
| Research | 12/12 byte-identical | Manifest 12/12 unchanged | Pass |
| Software | 12/12 byte-identical | 12/12 byte-identical | Pass |
| Courses | 12/12 byte-identical | 12/12 byte-identical | Pass |

The fallback was also challenged with an intentional nine-pixel green outline
on the biography. It rejected all three host-composed happy-state viewports and
returned exit code 3:

```text
NOT reproducible: 3 differ, 0 only in first run, 0 only in second (of 12)
intentional_regression_status=3
```

The temporary regression was reverted before the final gate. Baselines were
never rewritten.
