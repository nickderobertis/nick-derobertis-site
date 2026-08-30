# Design-system primitives: verification

What this records is the tree at the head of this branch, and for each
acceptance criterion the evidence that establishes it over that tree. Every
command below was run from the workspace root with an invocation-local
`NX_CACHE_DIRECTORY`, which `justfile` documents as the supported override.

## What moved

`libs/design-system` published 42 lines of CSS custom properties, a reset, the
`.main` container and the visually-hidden primitive — and nothing else — against
2,107 lines of per-app CSS in which every pane restated the same card, the same
section heading, the same page shell, the same action link, the same pane state
and the same 30-line loading skeleton.

It now publishes six React components beside the rules that paint them:

| Primitive | Class it publishes | Tokens it reads |
| --- | --- | --- |
| `PageShell` | `.pane`, `.pane-contained` | — |
| `SectionHeading` | `.section-heading`, `.eyebrow`, `.section-title`, `.section-description` | `--heading-layout`, `--eyebrow-*`, `--title-*` |
| `Card` | `.card` | `--card-surface`, `--card-border`, `--card-radius`, `--card-shadow`, `--card-padding` |
| `ActionLink` | `.action`, `.action:focus-visible` | `--action-padding`, `--action-border`, `--action-radius`, `--action-background`, `--action-color`, `--action-size`, `--action-weight`, `--action-tracking`, `--action-focus-ring` |
| `PaneState` | `.pane-state` | — |
| `Skeleton` | `.remote-skeleton`, the shimmer, its reduced-motion opt-out, and the `skeleton-heading/hero/banner/portrait/grid/split/list` parts | — |

Per-app CSS went from 2,107 lines to 1,422; `libs/design-system` went from 42
lines of CSS to 194. A pane that looks different now sets a token rather than
restating the primitive.

## Criterion by criterion

### 1. The design system exports the shared primitives, and every app that reimplemented one uses it

`libs/design-system/src/index.ts` exports `ActionLink`, `Card`, `PageShell`,
`PaneState`, `SectionHeading` and `Skeleton`, and `index.spec.ts` holds that
barrel to exactly those six. Adoption, by remote:

| Remote | `PageShell` | `SectionHeading` | `Card` | `ActionLink` | `PaneState` | `Skeleton` |
| --- | --- | --- | --- | --- | --- | --- |
| home | ✓ | | | | | ✓ |
| home-carousel | ✓ | | | ✓ | ✓ | ✓ |
| home-cards | ✓ | | ✓ | ✓ | ✓ | ✓ |
| home-story | ✓ | ✓ | | ✓ | ✓ | ✓ |
| home-contact | ✓ | ✓ | | | ✓ | ✓ |
| timeline | ✓ | ✓ | ✓ | | | ✓ |
| skills | ✓ | ✓ | ✓ | | | ✓ |
| awards | ✓ | | ✓ | | | ✓ |
| bio | ✓ | | | | | ✓ |
| research | ✓ | ✓ (banner and each section index) | | ✓ | | ✓ |
| software | ✓ | ✓ | ✓ | | | ✓ |
| courses | ✓ | ✓ | ✓ (course band, topic tiles, detail panes) | ✓ | | ✓ |

All twelve remotes adopt the page shell and the skeleton; six adopt the card,
seven the section heading, five the action link, four the pane state.

### 2. No app retains a private copy, and the superseded CSS is deleted

```
$ grep -nE "^\.(pane|pane-contained|pane-state|card|action|eyebrow|section-title|section-heading|remote-skeleton|skeleton-heading|skeleton-grid|skeleton-hero|skeleton-banner|skeleton-portrait|skeleton-list|skeleton-split)[ ,{:]" apps/*/src/*.css
(no matches)
```

Per-app CSS: 2,107 lines at `12e19c9` → 1,422 lines here. The dead `.hero`
rule that four apps carried and no markup used is gone with the rest.

Deliberately **not** extracted, and named here so it is a decision rather than
an oversight: `.awards-state`, `.skills-state` and `.timeline-state`/
`.timeline-empty` share three declarations (a `--sky` background, a `--blue`
left rule, and `1rem` of padding) but differ in their box model — two are
centred at the reading width, the third is not — and they are notices rather
than any of the six primitives this change publishes. Extracting them is a
follow-up, not part of this one.

### 3. `design-system` meets the testing bar and leaves the exemption

- `libs/design-system/project.json` declares the `test` target `just test`
  dispatches for this project: Vitest under `libs/design-system/vite.config.ts`,
  with coverage.
- `libs/design-system/vite.config.ts` states `lines/functions/branches/statements: 95`,
  which is where the floor is declared since `#88` made it per project. The run
  reports **100% on all four** (27/27 statements, 15/15 branches, 9/9 functions,
  25/25 lines).
- `scripts/workspace/structure-contract.spec.ts` now reads
  `const coverageExemptions = ["tooling-*"]`.
- `AGENTS.md`'s coverage sentence names exactly that one exemption, so
  `design-system` owes the floor like every other project.
- The llmlint justification in `libs/design-system/project.json`'s
  `metadata.description` no longer claims the project publishes only
  `theme.css` or declares no `test` target; it names the co-located component
  specs and the browser journeys that cover the painted result.

### 4. The structure contract agrees

`just test` passes over this tree. It runs the affected `test` and `e2e`
targets, and the one carrying this criterion belongs to `tooling-workspace`,
the project owning `structure-contract.spec.ts`, whose assertions include
"keeps AGENTS.md naming every project it exempts", "holds every project outside
those exemptions to that floor on all four metrics", "puts a spec beside every
component", and "keeps every component config a single validated declaration".
The command surface has no per-project test recipe: narrowing is done with the
`NX_BASE`/`NX_HEAD` range `just test` reads, not by naming a target.

### 5. The primitives are proven end to end through both render paths

`apps/home-cards/e2e/home-cards.spec.ts` and
`apps/home-story/e2e/home-story.spec.ts` each drive their pane through
`paneRenderPaths` — the remote's own published document and the Home page that
composes it — and assert what a visitor gets rather than what the markup says:

- the page shell holds a contained pane to 1,100px;
- the card renders and the action link paints `rgb(233, 81, 85)` on white,
  uppercase, with its 2px border;
- the action link's focus ring is reached **by tabbing**, not by programmatic
  focus, so the `:focus-visible` contract is what is tested, and is 3px solid
  white;
- the pane state's dashed border and muted text appear, with no `alert` role;
- the section heading's title is Georgia and navy, and its eyebrow and
  description are read out of the pane region the title names, so the
  `aria-labelledby` the heading carries is proven along with them.

`apps/shell/e2e/site.spec.ts` additionally paints every prerendered route and
every home pane **with JavaScript disabled**, through both render paths — which
is what caught the one real defect this change introduced (see below).

### 6. Rendering is preserved

Visual capture is deliberately off the `just` surface — `AGENTS.md` keeps
screenshots out of `just check` — so there is no recipe to record here. The
local command is the `.githooks/pre-push` guard (enabled once per clone with
`git config core.hooksPath .githooks`), which captures the affected
microfrontends in screencomp's pinned container and classifies them with the
pinned `screencomp v0.4.5` against each app's committed manifest; CI runs the
same classification as the `Visual docs` workflow's `classify-gate`. Over this
branch it is clean:

```
awards         added 0 changed 0 removed 0 unchanged 27
bio            added 0 changed 0 removed 0 unchanged 21
courses        added 0 changed 0 removed 0 unchanged 27
home           added 0 changed 0 removed 0 unchanged 21
home-cards     added 0 changed 0 removed 0 unchanged 21
home-carousel  added 0 changed 0 removed 0 unchanged 21
home-contact   added 0 changed 0 removed 0 unchanged 21
home-story     added 0 changed 0 removed 0 unchanged 21
research       added 0 changed 0 removed 0 unchanged 21
skills         added 0 changed 0 removed 0 unchanged 28
software       added 0 changed 0 removed 0 unchanged 21
timeline       added 0 changed 0 removed 0 unchanged 28
```

Every one of the twelve microfrontends is byte-identical to its committed
baseline, so **no app drifted and no baseline needed regenerating**. That is the
intended outcome: each primitive was extracted so that its declarations, and the
box each adopter renders, are what the adopter already had — an app that looked
different sets a token, and the tokens were chosen from the values that app
already declared.

One defect on the way there is worth recording, because it is the reason the
above is trustworthy rather than lucky. `--title-color: inherit` does not give a
custom property the token `inherit`: `inherit` is a CSS-wide keyword, so it makes
the property take its parent's (unset) value, and `var(--title-color,
var(--navy))` fell back to navy. Five banners meant "keep the colour this section
already has" and got a navy heading, two of them on a dark background.
`site.spec.ts` failed on `/research` painting its `h1` `rgb(18, 50, 74)` with
JavaScript disabled; the fix is `currentcolor`, which is treated as `inherit`
when it lands on `color` itself. It is commit `d12fcc6`.

### 7. Compose emits one shared block

`readRouteRemoteStyles` and `compose.mjs` now share one `groupRemoteStyles` in
`libs/artifact-contracts/src/remote-css.ts`, which splits each remote's built
stylesheet into top-level blocks and groups them by *which remotes own each
block* rather than by whole payload. Measured over the artifact this tree
composes:

| | at `12e19c9` | here |
| --- | --- | --- |
| `/` style elements | 8 | 9 |
| `/` inlined CSS | 29,811 bytes | 14,217 bytes |
| `/` document | 100,480 bytes | 85,433 bytes |

The first style element on `/` is attributed to
`home home-carousel home-cards home-story home-contact timeline skills awards`
and carries 4,008 bytes; the other eight carry each remote's own rules, still
attributed to it. Counting occurrences in the whole composed `/` document:

```
.card{                    1
.action{                  1
.pane{                    1
.pane-state{              1
.eyebrow{                 1
.section-title{           1
.remote-skeleton{         1
@keyframes skeleton-pulse 1
--navy:                   1
```

Before this change every one of those appeared eight times, once per pane.

### 8. Boundaries are unchanged

`libs/design-system/project.json` still declares `["type:shared",
"scope:design-system"]`, and its only workspace dependency is `@site/testing`,
which is `type:shared`. No remote's `boundaries.onlyDependOnLibsWithTags`
changed, and every remote already depended on `@site/design-system`, so
adopting a primitive adds no graph edge.

```
$ git diff 12e19c9 -- apps libs | grep '^+.*eslint-disable'
(no matches)
```

`just lint` passes over this tree. It runs `lint` for every project with
warnings as errors and then `typecheck` for every project, and the `shell:lint`
target it dispatches is the workspace-wide `eslint .` run — so the boundary
rules are checked over every project rather than over the shell alone.

### 9. Bundle budgets

The primitives ship inside all twelve remotes' federated `./Page` chunks, so
they were written to cost as little as they can: they call `createElement`
rather than spreading into JSX, because rest destructuring and a JSX spread
compile at this workspace's build target to roughly 1.5 KB of inlined
`Object.getOwnPropertyDescriptors` shims *per component*. Measured on this
tree, the naive JSX-spread form cost route `/` **+50,188 bytes** of `./Page`
JavaScript; the `createElement` form costs **+9,696**.

`scripts/artifact/bundle-budgets.json` was re-derived from what this tree
builds. Re-deriving is the one step here that no `just` recipe covers — the
command surface gates the committed ceilings but does not move them — and
`scripts/artifact/bundle-budgets.json`'s own leading note is where the way to
re-derive them is documented. The committed budgets pass:

```
$ just prerender
(exit 0 — compose, check-static-artifact and check-bundle-budgets all clean)
```

Net on the home route: +9,696 bytes of JavaScript, −15,594 bytes of inlined CSS.

### 10. The command surface this change is held to

| Command | What it runs | Result |
| --- | --- | --- |
| `just lint` | `lint` with warnings as errors, then `typecheck`, for every project | pass |
| `just test` | the affected `test` and `e2e` targets — over this tree `design-system`, `layout`, `artifact-contracts`, `shell` and the twelve remotes, plus `tooling-artifact` (with `tooling-compose`) and `tooling-workspace` | pass |
| `just prerender` | `shell:prerender`: compose, `check-static-artifact` and `check-bundle-budgets` | pass |

`artifact-contracts` is included because `groupRemoteStyles` and
`splitCssBlocks` live there; its own coverage is 99.5% statements, 97.95%
branches, 100% functions, 99.46% lines.

### What the recipes above leave to CI

`just check` is the whole pre-push gate: it dispatches the recipes above along
with the `build` targets, and it is the pull request's required `check`.
`just lint-llm-diff` is the judged tier, deliberately outside that gate and
required separately as `llmlint`.
