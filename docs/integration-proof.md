# Microfrontend integration proof

The commands below were run from the repository root on 2026-07-21. Nx's
`--files` mode supplies the named changed file directly, avoiding an artificial
commit while exercising the same affected-project graph used by `--base` and
`--head`.

## Shared design-system change

```console
$ pnpm exec nx show projects --affected --files=libs/design-system/src/theme.css --with-target=e2e --json
["home-carousel","home-contact","home-cards","home-story","research","software","timeline","courses","awards","skills","home","bio"]

$ pnpm exec nx affected -t e2e --files=libs/design-system/src/theme.css --parallel=3
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

  Run duration:      18.3s
  Cache:             13/26 hit (50%)
  Critical path:     6.0s (3 tasks)
  Recoverable time:  12.3s (67% of the run)
```

Those are the twelve remotes that import the design system, directly or through
the data-access library. No unrelated library or shell integration project has
an `e2e` target in this selection.

## Single remote change

```console
$ pnpm exec nx show projects --affected --files=apps/skills/src/page.tsx --with-target=e2e --json
["skills"]

$ pnpm exec nx run skills:e2e
Running 2 tests using 1 worker
  ✓  skills renders through its host-composed boundary
  ✓  skills renders through its standalone boundary
  2 passed (2.5s)

 NX   Successfully ran target e2e for project skills and 14 tasks it depends on
```

The dependent tasks are the fixed static-site build and prerender prerequisites;
the only executed e2e target is `skills:e2e`.

## Data-access dependency example

```console
$ pnpm exec nx show projects --affected --files=libs/data-access/src/site.ts --with-target=e2e --json
["home-carousel","home-contact","home-cards","home-story","research","software","timeline","courses","awards","skills"]
```

`home` and `bio` are correctly absent because they do not import data-access.
The shell-wide route, keyboard, fallback, and state matrix remains the explicit
`shell-e2e:integration` target run by `just check`; it is deliberately separate
from affected remote ownership.
