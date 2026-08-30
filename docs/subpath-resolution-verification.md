# Subpath resolution verification

Issue #92 splits `@site/data-access-core` into subpath modules
(`@site/data-access-core/site`, `/validators`, `/bundled`) beside the barrel it
already publishes. That is the shape a prefix-matched resolution silently
mis-answers: a longer specifier that begins with a shorter one is claimed by the
shorter one, and which of two overlapping mappings wins is decided by the order
they happen to be written in. This records what now holds the workspace to
answering each specifier with its own target, and the evidence for it over the
tree this file sits in.

## What resolves a workspace specifier here

Nothing in this workspace translates `tsconfig.base.json`'s
`compilerOptions.paths` into Vite aliases any more. `6d9a15a` (#88) removed
`resolveTsconfigAliases` from `libs/testing/src/index.ts` and `ed02a78` (#89)
removed the `paths` map it read, so workspace imports resolve through each
project's own package manifest — an `exports` map keyed by exact subpath, which
cannot prefix-match and has no order to depend on. `defineWorkspaceTestConfig`
still merges the `remotes` a host states, which are the only aliases left: no
manifest publishes a federation specifier.

Two resolvers have to agree and they are configured separately:

- the production build's, which is rspack's, configured by `remoteConfig`;
- the test runner's, which is Vite's, configured by the shared harness.

`scripts/workspace/subpath-resolution.spec.ts` drives both as real runs of the
thing that resolves. Its subjects are derived from the manifests that publish
them, so a subpath added tomorrow is covered the day it is added.

## Evidence, criterion by criterion

| Criterion | Evidence over this tree |
| --- | --- |
| `@site/<package>/<subpath>` resolves to its own module rather than to the shorter `@site/<package>`'s, in the bundler a production build uses | `subpath-resolution.spec.ts` compiles the configuration `apps/awards/rspack.config.ts` exports — `remoteConfig("awards")`, unchanged but for an added entry that imports the subpath specifiers for real — and reads back what that build produced, never what a resolver would answer if asked directly: "builds an import of every published subpath a bundle can hold" (no build errors), "answers every longer specifier with its own target, not the shorter one's" (the module graph's `nameForCondition` per request equals the file the manifest names), "carries each JSON subpath's own content into the chunk it emitted" (every string the JSON target is built from survives into the emitted bytes), and "refuses a subpath no package publishes" (the build errors with `Package subpath './published-by-nothing' is not defined by "exports"`, naming the mechanism the whole contract rests on). |
| The same property holds for the test runner, evidenced by a real spec run that imports the subpath specifier | `scripts/workspace/subpath-resolution-probe/src/subpath-resolution.spec.ts` `await import()`s every published subpath and compares the module object against a relative import of the file its manifest names. It runs under a component config `defineWorkspaceTestConfig` produced, which is the configuration every app and library is tested under, and `subpath-resolution.spec.ts` › "answers every longer specifier the same way under the shared test harness configured by %s" drives it as a real `pnpm exec vitest run` subprocess under that config and under `vite.config.reversed.ts`. Both configs are two lines over `subpath-resolution-probe/probe-config.ts`, which states the project, the directory, the coverage floor and the two remotes once; the reversed one applies that file's `reversed()` to the same map, so the order is the only difference either config can carry. |
| The check fails if the property stops holding, on both paths, and runs in its owning project's ordinary checks | Both halves live in `tooling-workspace` (`scripts/workspace/project.json`), whose `test` target runs Vitest over `scripts/workspace/vite.config.ts`; that config's `include` names `scripts/workspace/subpath-resolution.spec.ts`, so that target runs it, and `just test` and `just check` both dispatch that target through Nx's affected selection. The readings below are what each half reports when the property is broken. |
| Both halves derive their subjects rather than listing them, from one source | `scripts/workspace/published-subpaths.ts` is that source: its `overlappingSpecifiers()` reads every `package.json` under `apps/`, `libs/` and `scripts/`, validates it with a zod schema, and yields each `exports` subpath beside the bare specifier it begins with, so a subpath added tomorrow is covered the day it is added. Both halves import it — the build half as `./published-subpaths`, the probe as `../../published-subpaths` — and neither restates the schema or the derivation, so neither can drift into asking about a different set of subpaths than the other. Seven at the time of writing, published by `@site/build-config` (three), `@site/route-state`, `@site/data-access-core`, `@site/visual-harness` and `@site/artifact-contracts`. |
| A specifier both a caller's `remotes` map and a package manifest could answer goes to the remote | `defineWorkspaceTestConfig` merges the caller's `remotes` as the only aliases left, so the probe's config deliberately states `@site/build-config/remote-registry` — a specifier `@site/build-config` publishes too. The probe's "answers with the remote where a package publishes the same specifier" asserts the remote's own export is what arrives and that the package module's `validatedRemoteRegistry` is not, and "answers a federation specifier no manifest publishes" resolves `homeCards/Skeleton`, which nothing but the merge can answer. |
| Correctness does not depend on the order a map is written in | The ordered map that used to decide it is gone: an `exports` map is keyed by exact subpath, so no key in it can claim the path below another. What is still an ordered map is the `remotes` a caller states, so that one is proved rather than argued — `probe-config.ts` states those two entries once, `vite.config.reversed.ts` hands `probeConfig` the same map reversed, and the whole probe runs under both. |
| No production behaviour changes | The property already held. Nothing under `apps/` or `libs/` is touched: the branch adds `scripts/workspace/subpath-resolution.spec.ts`, `scripts/workspace/published-subpaths.ts`, the probe it drives, this document, and the one dependency the contract needs — `@site/build-config` in `scripts/workspace/package.json`, which the contract imports for `remoteConfig` and `remoteRegistry`. |
| `resolveTsconfigAliases` is not reintroduced and `tsconfig.base.json` gains no project `paths` | `grep -rn resolveTsconfigAliases` over the tree matches nothing outside this document, where it names the commit that removed it, and `grep -n paths tsconfig.base.json` matches nothing at all. |

## The readings that would fail

Each half was held to an input it has to report before it was accepted.

- Give the test harness back a prefix-matched shorter alias
  (`"@site/build-config"` as a remote): the probe reports
  `Vitest could not resolve @site/build-config/fragment-contract, which its
  package publishes as libs/build-config/src/fragment-contract.ts`, and the same
  for `@site/build-config/remotes.json`.
- Drop the caller's `remotes` from the probe's config: both remote readings fail.
- State the shorter `"@site/build-config"` as the reversed config's remote in
  place of the subpath it publishes: the probe reports the same two unresolved
  specifiers under that config as under the first one, so the pair reports a
  prefix match whichever of the two carries it.
- Point the build's `resolve.alias` at the barrel for one published subpath
  (`"@site/route-state/contracts.json"` at `libs/route-state/src/index.ts`),
  which is the answer a prefix-matched resolution gives: the build half reports
  `the awards build resolved @site/route-state/contracts.json to
  .../libs/route-state/src/index.ts, not to
  .../libs/route-state/src/contracts.json, which its package publishes for it —
  it was answered by @site/route-state itself`.
- Build with `resolve.exportsFields: []`, which is what a production resolution
  that had stopped reading manifests amounts to: all four production readings
  fail, each naming the specifier and the target its package publishes for it.

## What a subpath a browser bundle cannot hold is held to

rspack polyfills no Node builtin, so a module that imports one is never bundled
and no production build ever asks for it —
`@site/artifact-contracts/artifact-hold` and `@site/build-config/remote-registry`
are the two. The test runner imports both for real, which is the only boundary
that ever resolves them: between the two halves every published subpath is
resolved for real.

## Checks run over this tree

| Project | `test` | `typecheck` | `lint` |
| --- | --- | --- | --- |
| `tooling-workspace` (owns both halves of the contract and the derivation they share) | `Test Files 10 passed (10)`, `Tests 141 passed (141)` | clean | `Checked 30 files. No fixes applied.` |
| `testing` (`libs/testing`, the harness the probe runs under) | `Test Files 1 passed (1)`, `Tests 10 passed (10)`, coverage 100/100/100/100 | clean | `Checked 7 files. No fixes applied.` |
| `build-config` (`libs/build-config`, publisher of three of the subpaths) | `Test Files 7 passed (7)`, `Tests 43 passed (43)`, coverage 100/100/100/100 | clean | `Checked 26 files. No fixes applied.` |
| `awards` (the app whose `remoteConfig` the build half compiles) | `Test Files 10 passed (10)`, `Tests 39 passed (39)` | clean | `Checked 34 files. No fixes applied.` |
| `shell` | `Test Files 10 passed (10)`, `Tests 51 passed (51)`, coverage 100/100/100/100 | clean | `eslint . --max-warnings=0` plus `Checked 39 files. No fixes applied.` |

Run them through this repository's own command surface, never through a
hand-rolled task-runner invocation:

- `just lint` runs the `lint` and `typecheck` targets of every project, with
  lint warnings as errors. It covers both of those columns for every row above.
- `just test` runs the `test` and `e2e` targets of the projects a commit range
  affects. `NX_BASE` and `NX_HEAD` bound that range and default to
  `HEAD~1..HEAD`, so `NX_BASE` pointed at this branch's base selects every
  project above — and, through this branch's lockfile change, every other
  project in the workspace too.
- `just check` is the full pre-push gate: the whole-tree Biome pass, then lint,
  typecheck, test, build, prerender, e2e and screenshot over what is affected.
  It is left to the merge path.

Each recipe collects its dispatch's output and prints it only when a target
fails, so a clean run says nothing and its exit status is the whole result. The
readings in the table are what each project's own target reported over this
tree.
