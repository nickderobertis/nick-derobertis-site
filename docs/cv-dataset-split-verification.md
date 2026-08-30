# Splitting `data-access-core`: what was verified, and how

Issue #92's item A2. `libs/data-access-core/src/client.ts` statically imported
the CV aggregate, all six domain files and the schema, then ran
`createCvDataClient` at module scope — seven Ajv validators compiled, the root
validated, every domain file serialised twice to compare it against the
aggregate — and the barrel re-exported it, so every container that imported one
constant paid for all of it. This records the evidence for each property the
change owes, over the tree that carries it.

Everything below was run in this worktree, over the artifact
`nx run shell:prerender` composes from it.

## The three surfaces

| specifier | module | holds |
| --- | --- | --- |
| `@site/data-access-core` | `src/index.ts` | type re-exports, nothing runtime |
| `@site/data-access-core/site` | `src/site.ts` | `siteBase` |
| `@site/data-access-core/validators` | `src/validators.ts` | the schema, Ajv, `validateCvDomain`, `validateCvData` |
| `@site/data-access-core/bundled` | `src/bundled.ts` | the static data imports and `createCvDataClient` |

**The plan named `tsconfig.base.json` as where the two new specifiers are
declared; that mechanism no longer exists.** `ed02a78 perf(nx): retire the
tsconfig path aliases (#89)` removed project `paths`, and a package's own
manifest publishes its subpaths now. So they are declared in
`libs/data-access-core/package.json`'s `exports`, and what binds — that each
resolves to its own module for the bundler and the test runner alike — is held
by `scripts/workspace/subpath-resolution.spec.ts` and the probe beside it, which
take their subjects from `scripts/workspace/published-subpaths.ts`. That
derivation reads the manifests, so both new subpaths were enrolled the moment
they were published:

```
@site/data-access-core/bundled   -> libs/data-access-core/src/bundled.ts
@site/data-access-core/site      -> libs/data-access-core/src/site.ts
@site/data-access-core/validators -> libs/data-access-core/src/validators.ts
```

`nx run tooling-workspace:test` is green over this tree, which is that contract
driven through a real rspack build and a real Vitest run.

## The dataset is gone from every container that does not read it

A marker per domain, taken out of the committed domain file itself rather than
restated here, swept over every JavaScript file each container's document and
`./Page` expose load:

| container | CV content | `cv.schema.json` | Ajv |
| --- | --- | --- | --- |
| shell entry | absent | present | present |
| awards | absent | present | present |
| bio | absent | absent | absent |
| home | absent | absent | absent |
| home-cards | absent | absent | absent |
| home-carousel | absent | absent | absent |
| home-contact | absent | absent | absent |
| home-story | absent | absent | absent |
| courses, research, skills, software, timeline | present | present | present |

The shell and awards carry the schema and Ajv because they validate a fetched
payload, which is the criterion's own reading. The five that still carry the
dataset are the five feature modules issue #92's A3 moves onto their own domain
slices; they are named in this node's task as expected to stay.

`@site/data-access-core/bundled` is imported by exactly those five —
`apps/skills/src/page.tsx`, `apps/timeline/src/page.tsx`,
`apps/research/src/use-research-page.ts`,
`apps/software/src/use-software-page.ts`,
`apps/courses/src/use-courses-page.ts` — by the build-time fragment renderer
`libs/build-config/src/shell-fragment-entry.tsx`, and by specs. Nothing else.

## What the browser now pays on load

`src/validators.ts` imports no CV data and runs no aggregate-versus-domain
comparison, and it builds Ajv and each validator on first use rather than one
per domain at module scope. `validators.spec.ts` asserts that importing the
module compiles nothing, that two validations of one domain compile once, and
that a second domain and the root each add exactly one. Restoring eager
compilation fails that spec with `expected "compile" to not be called at all,
but actually been called 7 times`.

## The integrity check is still a check

`createCvDataClient` still validates the aggregate, validates each domain
artifact, and refuses one that disagrees with the aggregate. It no longer runs
at module scope: `bundled.spec.ts` runs it over the committed aggregate and
every committed domain file, once per `nx run data-access-core:test`, and
asserts refusal for each of the six domains in turn. Dropping one award from
`vendor/codegen/domains/awards.json` and running that spec fails 7 of its 11
tests with `CV awards domain failed drift validation: artifact differs from
validated root data`.

## The fetch paths still refuse what they refused

Schema rejection, in a real browser, on both render paths:

- awards — `apps/awards/e2e/awards.spec.ts` gains
  `reaches its error state when the awards payload fails the CV schema`, run
  host-composed and standalone. It answers the awards endpoint with `200` and a
  body that is not an awards collection and watches the pane settle on its
  `Awards unavailable` alert. Removing `validateCvDomain` from
  `use-awards.ts` and rebuilding fails exactly those two journeys and nothing
  else in the suite.
- the shell's route loaders already served one:
  `apps/shell/e2e/site.spec.ts`'s `answers with a body the CV schema rejects`
  case runs over `/research`, `/software` and `/courses`.

Refusing a failed response without reading its body:
`apps/shell/src/browser-domain.spec.ts` and `apps/awards/src/use-awards.spec.ts`
each answer with a failed response whose body rejects and counts the attempt.
Reading the body before checking the status fails the shell's spec with
`expected [Function] to throw error including 'courses request failed: 503' but
got 'the failed body was read'` and awards' with `expected 1 to be +0`.

## The payload, measured

Re-derived by `node scripts/artifact/check-bundle-budgets.mjs --rederive` over
the artifact this tree composes, and gated at that new floor by the same script
with no arguments, which `shell:prerender` runs.

| app | entry before | entry after | `./Page` before | after |
| --- | ---: | ---: | ---: | ---: |
| shell | 2,095,662 | 615,161 | — | — |
| awards | 2,071,845 | 591,312 | 1,635,955 | 155,424 |
| courses | 2,127,012 | 2,124,031 | 1,632,844 | 1,629,863 |
| research | 2,123,888 | 2,120,930 | 1,629,584 | 1,626,626 |
| skills | 2,072,026 | 2,069,029 | 1,636,047 | 1,633,050 |
| software | 2,122,783 | 2,119,800 | 1,628,534 | 1,625,551 |
| timeline | 2,067,909 | 2,064,919 | 1,631,925 | 1,628,939 |

| route | before | after |
| --- | ---: | ---: |
| `/` | 5,184,632 | 3,698,118 |
| `/research` | 1,629,584 | 1,626,626 |
| `/software` | 1,628,534 | 1,625,551 |
| `/courses` | 1,632,844 | 1,629,863 |
| `/bio` | 6,762 | 6,762 |

`/`'s remaining 3.7 MB is skills and timeline, which A3 moves. The three
pure-`siteBase` panes and `home-contact` are unchanged, which is the control:
they had already been cleaned by #100 and nothing here disturbed them.

## The composed document is what it was

Nothing here changed what the fragment renderers read or what compose assembles
from them: `shell-fragment-entry.tsx` reads the same client through the bundled
subpath, and the CV data compose stages under `cv-data` is unchanged. The
composed `/` document is 100,503 bytes and `/research` 54,107.
`nx run tooling-artifact:test` — which composes and gates the real artifact
first — passes over it, as does `scripts/artifact/check-static-artifact.mjs`
inside `shell:prerender`, and `apps/shell/e2e/site.spec.ts` drives that document
in a browser with JavaScript disabled and through hydration.

## `ajv/dist/standalone`, considered and not taken

Recorded at the site, in `src/validators.ts`. It compiles: the awards domain
schema precompiles cleanly through `standaloneCode` with this workspace's
`discriminator` keyword and `ajv-formats`. It does not do what it was
considered for. `standaloneCode` inlines the schema each validator closes over,
and awards — the smallest domain — emits 24,324 bytes of inlined schema on its
own, so precompiling would put a copy of `cv.schema.json` in the bundle per
domain rather than remove the one that is there. It cannot remove that one
either: this plan's shared contract has the validators module export
`cvSchema`, so the document stays reachable from it. Taking it would also owe a
generated artifact and a gate holding that artifact to `cv.schema.json`, which
is its own change. Left for whoever revisits the shared contract.

## Checks run over this tree

| check | result |
| --- | --- |
| `nx run-many -t typecheck -p data-access-core,build-config,shell,awards,skills,timeline,research,software,courses,home` | pass |
| `nx run-many -t test` over those ten plus the six `data-access-*` domain libraries | pass |
| `nx run shell:lint` (workspace-wide `eslint .` plus Biome) | pass |
| `biome check --error-on-warnings .` | pass, 652 files |
| `nx run shell:prerender` (compose, static-artifact gate, bundle-budget gate) | pass |
| `nx run-many -t test -p tooling-workspace,tooling-artifact,tooling-compose` | pass |
| `nx run awards:e2e` | pass, 32 tests |
| `nx run shell:e2e` | pass, 48 tests |

The shell's two `@nx/enforce-module-boundaries` disables moved onto their new
specifiers and no project gained one; `shell:lint` is what says so, because it
reports an unused disable directive as an error under `--max-warnings=0`.
