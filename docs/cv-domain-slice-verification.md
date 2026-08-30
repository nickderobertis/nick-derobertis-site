# Each feature reads its own CV domain: what was verified, and how

Issue #92's item A3. Five features read the whole CV through
`@site/data-access-core/bundled` — `apps/skills/src/page.tsx`,
`apps/timeline/src/page.tsx`, `apps/research/src/use-research-page.ts`,
`apps/software/src/use-software-page.ts` and `apps/courses/src/use-courses-page.ts`
— so each of their bundles carried the 785 KB aggregate and all six domain files
for the one slice it renders. Each now reads its domain through its own
`data-access-<domain>` library, which imports that domain's committed file alone
and validates it against the CV schema as it loads. This records the evidence for
each property the change owes, over the tree that carries it.

Everything below was run in this worktree over the artifact
`nx run shell:prerender` composes from it.

## Where the plan's naming had moved

The plan was written against `7b6d0e5`, and one mechanism it names is gone.
`ed02a78 perf(nx): retire the tsconfig path aliases (#89)` removed project
`paths` from `tsconfig.base.json`; a package's own manifest publishes its
specifiers now. So the six per-domain modules this change adds are published in
`libs/data-access-core/package.json`'s `exports`, not in a `paths` map:

```
@site/data-access-core/domains/awards            -> src/domains/awards.ts
@site/data-access-core/domains/courses           -> src/domains/courses.ts
@site/data-access-core/domains/research          -> src/domains/research.ts
@site/data-access-core/domains/skills            -> src/domains/skills.ts
@site/data-access-core/domains/software_projects -> src/domains/software_projects.ts
@site/data-access-core/domains/timeline          -> src/domains/timeline.ts
```

`scripts/workspace/published-subpaths.ts` derives the subpath-resolution
contract from those manifests, so all six were enrolled in
`scripts/workspace/subpath-resolution.spec.ts` — the real rspack build and the
real Vitest probe beside it — the moment they were published. Nothing here
declares them a second time.

The JSON is reached through a module rather than published as a `.json` subpath
on purpose. `subpath-resolution.spec.ts` requires every string in a published
JSON target to survive verbatim into the chunk the build emits, and the CV
domains carry newlines, backslashes and non-ASCII punctuation that a bundler
re-escapes on the way out. A module target states the same resolution contract
without asking a build to answer a question about escaping.

## What each consumer reads now

| consumer | reads | through |
| --- | --- | --- |
| `apps/skills/src/page.tsx` | `skills` | `@site/data-access-skills` |
| `apps/timeline/src/page.tsx` | `timeline` | `@site/data-access-timeline` |
| `apps/research/src/use-research-page.ts` | `research` | `@site/data-access-research` |
| `apps/software/src/use-software-page.ts` | `softwareProjects` | `@site/data-access-software` |
| `apps/courses/src/use-courses-page.ts` | `courses` | `@site/data-access-courses` |

No production module in any app imports `@site/data-access-core/bundled` any
more. The bundled client's one remaining importer is
`libs/build-config/src/shell-fragment-entry.tsx`, the build-time fragment
renderer, where a static import of the whole CV is correct and free — the same
place `3e36f6a` left it — plus the specs of the shell, home, awards and
`data-access-core` itself, none of which a browser loads.

`bundled.ts` is now assembled from those same six domain modules rather than
from a second set of imports of the same files, so there is one import of each
committed domain file in the workspace.

## Validation, at import

Each `data-access-<domain>` library carries a `src/data.ts` that reads its
artifact and hands it to `validateCvDomain` from
`@site/data-access-core/validators` before exporting it. There is one committed
file and one answer about it, so the check runs where the module loads: a slice
the schema rejects fails the import, and no consumer can render from data
nothing checked.

`src/data.spec.ts` beside each of the five is what proves it. Each loads
`./data` into a fresh module registry twice — once over the committed file, once
over a slice the schema rejects, supplied in place of the artifact module — and
the refusal under test is that import failing:

```
libs/data-access-skills/src/data.spec.ts
  ✓ exports the committed domain once the schema has accepted it
  ✓ refuses at import when the slice does not satisfy the schema
```

Removing the validation — `export const skills = skillsArtifact as Skills` —
fails exactly the second case, with

```
AssertionError: promise resolved "{ skills: [ { id: 'python' } ], …(1) }" instead of rejecting
```

and the refusal the committed module raises is the validator's own:

```
CvDomainValidationError: CV skills domain failed schema validation:
  data/0 must have required property 'name', data/0 must have required property 'level'
```

Each of the five stands a different malformed record in: a skill with no name or
level, an education entry with no organization, a research project with no title
or status, a software project with no name, a course with no title.

## Exactly one CV data file per feature, read out of the graph

`scripts/artifact/cv-data-reachability.spec.ts` is the check the payload gates
beside it cannot make. A bundle budget is a size and the artifact gate's content
sweep is a sample of strings, so a domain that arrived in a chunk minified,
re-encoded or merely unsampled passes both. This walks each app's own module
graph — every non-spec module under `apps/<app>/src`, which is a superset of the
`main.tsx` its `project.json` declares and the `./Page` expose a host composes —
and reports which committed CV files it can follow an import to.

The walk reads imports off TypeScript's own syntax tree, so a static import, a
re-export and a dynamic `import()` all count, a specifier written inside a string
does not, and a type-only import — which the compiler erases, and which is how
`@site/data-access-core`'s barrel re-exports the bundled client's *type* — is not
followed. `@site` specifiers are resolved by Node itself through the `exports`
map the package publishes, which is the map the bundler and the test runner
resolve them through too.

Its 18 cases are green over this tree:

- each of `skills`, `timeline`, `research`, `software` and `courses` reaches
  exactly `domains/<its own>.json` — not the aggregate, not another domain's;
- each reaches it through `libs/data-access-<domain>/src/data.ts`;
- `awards` reaches no CV data at all, which is the control from the other
  direction: it fetches its published slice and validates the response;
- `libs/data-access-core/src/bundled.ts` reaches all seven files, which is what
  says an empty result above is a graph holding no CV data rather than a walk
  that sees none;
- each `data-access-<domain>` library's own barrel carries only its domain.

Pointing `apps/skills/src/page.tsx` back at `cvDataClient` fails one case and
names what came back with it:

```
× gives skills its own domain file and no other CV data
+ "libs/data-access-core/vendor/codegen/cv.json",
+ "libs/data-access-core/vendor/codegen/domains/software_projects.json",
```

## Both render paths, in a real browser

`research`, `software` and `courses` keep the standalone-preview fallback: with
no props supplied they render from the committed slice, and under the shell they
render from the payload the route loader fetched and validated. Both paths are
driven by those apps' existing journeys — `apps/<app>/e2e/<app>.spec.ts` and
`apps/<app>/e2e/ownership.spec.ts`, which open the standalone remote and the
host-composed route over the built artifact — and by `apps/shell/e2e/site.spec.ts`,
whose loader cases include the response the CV schema rejects. Nothing about the
shell's fetch path changed here.

The `e2e` targets of `shell`, `skills`, `timeline`, `research`, `software`,
`courses` and `home` all pass over this tree.

## Prerendering is untouched

The fragment renderers read the same client through the same subpath, and the CV
data compose stages under `cv-data` is unchanged. The composed documents are
byte-for-byte the sizes `3e36f6a` recorded:

| document | bytes |
| --- | ---: |
| `/` | 100,503 |
| `/research` | 54,107 |

`/software` (839,962) and `/courses` (27,064) are likewise unchanged: the
prerendered markup is what the route loader's data renders to, and that data did
not move.

The `tooling-artifact` project's `test` target — which composes and gates the
real artifact first — passes over this tree, as do the static-artifact gate and
the budget gate inside `shell:prerender`.

## Module boundaries

Nothing was widened and nothing was disabled. Each of the five apps already
declares the `data:<domain>` tag it needs in its own `project.json`
`metadata.boundaries.onlyDependOnLibsWithTags`, and each domain library is
`type:data-domain`, which the root `depConstraints` already lets depend on
`type:data-core`. `nx run shell:lint` — this workspace's whole-workspace
`eslint . --max-warnings=0` plus Biome — is green.

`apps/skills` no longer names `@site/data-access-core` in any module, so its
manifest no longer declares it; `scripts/workspace/project-manifest.spec.ts`
holds every project to declaring exactly the `@site` packages it imports.

## The payload, measured

Re-derived by `node scripts/artifact/check-bundle-budgets.mjs --rederive` over
the artifact this tree composes, and gated at that new floor by the same script
with no arguments, which `shell:prerender` runs.

| app | entry before | entry after | `./Page` before | after |
| --- | ---: | ---: | ---: | ---: |
| courses | 2,124,031 | 654,608 | 1,629,863 | 160,442 |
| research | 2,120,930 | 669,285 | 1,626,626 | 174,981 |
| skills | 2,069,029 | 671,712 | 1,633,050 | 235,733 |
| software | 2,119,800 | 1,256,328 | 1,625,551 | 762,079 |
| timeline | 2,064,919 | 597,955 | 1,628,939 | 161,971 |
| awards | 591,312 | 591,329 | 155,424 | 155,441 |
| home | 514,876 | 514,872 | 65,712 | 65,712 |
| shell | 615,161 | 615,161 | — | — |

| route | before | after |
| --- | ---: | ---: |
| `/` | 3,698,118 | 833,850 |
| `/research` | 1,626,626 | 174,981 |
| `/software` | 1,625,551 | 762,079 |
| `/courses` | 1,629,863 | 160,442 |
| `/bio` | 6,762 | 6,762 |

`/` is down 4.4x, on top of the 1.49 MB `3e36f6a` took out of it. `software`
remains the largest because `software_projects.json` is 599,676 bytes — 76% of
the whole CV — and it is the domain that pane renders, which is the point: the
payload is now proportional to what a page reads. `awards`, `home` and `shell`
are the control: none of them reads a bundled slice and none of them moved
(awards' 17 bytes are module-identifier text, not payload).

`marginPercent` stays 0.05, and the bound `bundle-budgets.spec.ts` derives for it
still holds with room to spare: the smallest domain, `awards.json` at 1,256
bytes, is 0.165% of the largest budgeted `./Page` chunk, which is now
`software`'s 762,079.

## Targets run over this tree

`test` and `typecheck` for `skills`, `timeline`, `research`, `software`,
`courses`, `awards`, `home`, `shell`, `data-access-skills`,
`data-access-timeline`, `data-access-research`, `data-access-software`,
`data-access-courses`, `data-access-awards` and `data-access-core`;
`lint` and `typecheck` and `test` for `tooling-artifact`; `lint` for `shell`;
`e2e` for `shell`, `skills`, `timeline`, `research`, `software`, `courses` and
`home`.
