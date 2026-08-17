# Non-data library coupling audit

This audit covers every non-data library in `libs/`. Consumer counts and
affected results were taken from Nx's project graph, not inferred from folder
names.

| Library | Finding | Disposition |
| --- | --- | --- |
| `design-system` | The exported `AwardEmblem` was awards-only. `theme.css` also bundled shell layout, Home panes, every remote's skeleton, and complete Software and Courses presentation. | Moved `AwardEmblem` beside the awards page. Reduced `theme.css` to tokens, reset, the shared standalone/host `.main` container, and the reusable visually-hidden primitive. Moved shell-only rules to `layout`; moved page and skeleton rules to each owning remote. |
| `ui` | Its only content was an unused `Tone` type. It had no source imports; the layout edge was a stale implicit dependency. | Removed the empty project, alias, and stale edge. |
| `layout` | It contains only the shell-owned `SiteLayout`; the shell is its only source consumer. Its declared implicit dependencies did not correspond to imports. | Moved shell header/main/footer CSS here, removed the false implicit dependencies, and confirmed cohesion. `type:layout` prevents remotes from importing it. |
| `analytics` | `trackEvent` had no consumer, no bootstrap integration, no measurement identifier, and no analytics script in any HTML or deployment configuration. Its test covered only the otherwise-dead wrapper. There is therefore no real integration point to preserve. | Removed the dead project and alias. Analytics can return as an integration feature when there is a provider/configuration and browser journey to prove it. |
| `build-config` | All twelve remote rspack configurations use `remoteConfig`; the two federation hosts additionally use `remoteMap`. Both functions share the same validated remote manifest, Pages base, and Module Federation setup, so splitting them would duplicate one build contract without reducing affected builds. | Confirmed cohesive and clean. |
| `publish-config` | The content-store publish path was a quarter of `build-config` and no app imported it, but eleven apps compiled it through a `tsconfig.app.json` `include` glob, so an edit to it selected twenty projects — thirteen of them app builds a visitor's bytes never depend on. | Removed the glob and moved `publish-fragment.ts` here, keeping the one leaf-ward edge back to `build-config` for `fragmentContractSchema`. An edit to the publish path now selects only `["publish-config"]`, asserted in `affected-build-projects.spec.ts`; `structure-contract.spec.ts` reads each app's real tsc program and fails if one compiles a publish module again. |

## Boundary and affected-economics proof

The awards remote already carries `scope:awards`. The root module-boundary
constraints permit that scope to depend only on shared, core-data, and
awards-data projects. A real ESLint boundary test now imports the relocated
component from the research remote and proves the cross-domain edge is
rejected.

Before the move, running
`just affected-build-projects libs/design-system/src/award-emblem.tsx`
selected `design-system` plus thirteen application builds: `home-carousel`,
`home-contact`, `home-cards`, `home-story`, `research`, `software`, `timeline`,
`courses`, `awards`, `skills`, `shell`, `home`, and `bio`.

After the move, `just affected-build-projects apps/awards/src/award-emblem.tsx`
returns `["awards","shell"]`: no other remote, and the shell only because it
owns the workspace's single `eslint .` run, whose cache key covers every
TypeScript file and which Nx selects by marking its project affected rather
than the target alone. The shell's own build replays from cache, since none of
its inputs moved. This is also asserted through the real `just`/Nx subprocess
in `affected-build-projects.spec.ts` so graph drift fails the test.

The same subprocess proof covers presentation ownership. Editing
`apps/software/src/software.css` selects only `["software"]`; editing the
child-remote stylesheet `apps/home-carousel/src/carousel.css` selects
only `["home-carousel"]`. The boundary test also proves a Research source file
cannot import Software's owned stylesheet.
