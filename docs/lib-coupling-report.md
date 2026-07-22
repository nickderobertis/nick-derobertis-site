# Non-data library coupling audit

This audit covers every non-data library in `libs/`. Consumer counts and
affected results were taken from Nx's project graph, not inferred from folder
names.

| Library | Finding | Disposition |
| --- | --- | --- |
| `design-system` | The exported `AwardEmblem` was awards-only. The remaining entry point is the global stylesheet used by every standalone remote and the shell; it supplies the shared tokens, reset, common state/skeleton treatments, and the single site-wide stylesheet needed for composed remotes. | Moved `AwardEmblem` beside the awards page and removed the shared export. The shared stylesheet remains the common visual contract. |
| `ui` | Its only content was an unused `Tone` type. It had no source imports; the layout edge was a stale implicit dependency. | Removed the empty project, alias, and stale edge. |
| `layout` | It contains only the shell-owned `SiteLayout`; the shell is its only source consumer. Its declared implicit dependencies did not correspond to imports. | Confirmed cohesive; removed the false implicit dependencies. `type:layout` already prevents remotes from importing it. |
| `analytics` | `trackEvent` had no consumer, no bootstrap integration, no measurement identifier, and no analytics script in any HTML or deployment configuration. Its test covered only the otherwise-dead wrapper. There is therefore no real integration point to preserve. | Removed the dead project and alias. Analytics can return as an integration feature when there is a provider/configuration and browser journey to prove it. |
| `build-config` | All twelve remote rspack configurations use `remoteConfig`; the two federation hosts additionally use `remoteMap`. Both functions share the same validated remote manifest, Pages base, and Module Federation setup, so splitting them would duplicate one build contract without reducing affected builds. | Confirmed cohesive and clean. |

## Boundary and affected-economics proof

The awards remote already carries `scope:awards`. The root module-boundary
constraints permit that scope to depend only on shared, core-data, and
awards-data projects. A real ESLint boundary test now imports the relocated
component from the research remote and proves the cross-domain edge is
rejected.

Before the move, running
`nx show projects --affected --files=libs/design-system/src/award-emblem.tsx --with-target=build --json`
selected `design-system` plus thirteen application builds: `home-carousel`,
`home-contact`, `home-cards`, `home-story`, `research`, `software`, `timeline`,
`courses`, `awards`, `skills`, `shell`, `home`, and `bio`.

After the move, `just affected-build-projects apps/awards/src/award-emblem.tsx`
returns only `["awards"]`. This is also asserted through the real `just`/Nx
subprocess in `affected-build-projects.spec.ts` so graph drift fails the test.
