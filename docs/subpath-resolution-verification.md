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
| A longer specifier that begins with a shorter alias resolves to its own target | `subpath-resolution.spec.ts` › "answers every longer specifier with its own target, not the shorter one's" reads the module graph of a real `remoteConfig("awards")` build and holds every published subpath to the file its manifest names; the probe's sweep does the same through a real `import()` under the harness. Both derive the overlaps from the manifests rather than listing them: seven at the time of writing, published by `@site/build-config` (three), `@site/route-state`, `@site/data-access-core`, `@site/visual-harness` and `@site/artifact-contracts`. |
| A `/*` wildcard mapping is translated with the remainder carried | Not applicable over this tree, and deliberately not reinstated: no `paths` map survives for a wildcard to appear in, and no caller states a wildcard remote. The exports maps this workspace publishes are exact subpaths. |
| `defineWorkspaceTestConfig` still merges caller-supplied `remotes`, and a remote wins where both could match | `libs/testing/src/index.spec.ts` › "builds the fixed component-test contract and merges remote aliases" for the returned configuration; the probe resolves both for real — "answers a federation specifier no manifest publishes" (nothing but the merge can answer `homeCards/Skeleton`) and "answers with the remote where a package publishes the same specifier" (the probe states `@site/build-config/remote-registry` as a remote, which `@site/build-config` publishes too, and the remote answers). |
| A malformed `paths` entry still refuses at the same boundary | `libs/testing/src/index.spec.ts` › "refuses %s at the configuration boundary" — five malformed component configs, each refused by the same `optionsSchema` with the same `Invalid workspace test configuration` diagnostic naming the offending key. |
| Correctness does not depend on key order | The ordered map that decided it is gone: an `exports` map is keyed by exact subpath, so no key in it can claim the path below another and there is no order for a resolution to depend on. What is still an ordered map is the `remotes` a caller states, so that one is proved rather than argued: `scripts/workspace/subpath-resolution-probe/vite.config.reversed.ts` states the same map as `vite.config.ts` in the opposite order and differs in nothing else, and `subpath-resolution.spec.ts` › "answers every longer specifier the same way under the shared test harness configured by %s" runs the whole probe under both, so every resolution the probe reads — the manifests' overlaps, the federation specifier, and the remote stated over a specifier `@site/build-config` publishes too — has to be the same answer either way round. |
| A spec drives the real resolver over a plain alias and a longer one sharing its prefix | Both halves of `subpath-resolution.spec.ts` do, over the manifests' own overlaps rather than a hand-written pair. |
| Proven end to end through a configuration `defineWorkspaceTestConfig` produced | `scripts/workspace/subpath-resolution-probe/` runs under two configs that harness produced, imports every subject for real, and is driven as a real Vitest subprocess by `subpath-resolution.spec.ts` › "answers every longer specifier the same way under the shared test harness configured by %s". |
| The production side is proven by a real build | `subpath-resolution.spec.ts` compiles the configuration `apps/awards/rspack.config.ts` exports, with one added entry that imports the subpath specifiers, and reads back what the build produced: no errors, the module graph's answer per specifier, the bytes of the chunk it emitted (every string each JSON subpath is built from), and a refusal naming the exports map for a subpath no package publishes. |

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

| Command | Result |
| --- | --- |
| `nx run-many -t test -p testing data-access-core shell awards tooling-workspace` | passed |
| `nx run-many -t typecheck,lint -p testing tooling-workspace` | passed |
| `nx run shell:lint` (`eslint .` over every project plus Biome) | passed |
