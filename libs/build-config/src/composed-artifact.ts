/**
 * The one tree this workspace composes the whole site into, named once.
 *
 * `shell:build` writes it and `shell:prerender` composes every app's fragment
 * into it in place, so it is what `scripts/serve/serve-e2e.mjs` serves for the
 * browser journeys, what `scripts/serve/serve-dev.mjs` claims before it starts
 * a development server over it, and what `rspack-dev.ts` mounts every sibling
 * of the app under development out of. Each of those states the path by
 * importing it rather than by repeating it, so moving the artifact is one edit.
 *
 * It is workspace-relative because every consumer resolves it that way: rspack
 * static directories, Nx outputs, and a CLI running from the workspace root.
 */
export const composedArtifactRoot = "dist/apps/shell";
