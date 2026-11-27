import type { AnyRouter } from "@tanstack/router-core";

/** The one step of router-core's framework-only SSR surface this reads. */
type HydrationSource = Pick<
  NonNullable<AnyRouter["serverSsr"]>,
  "takeInitialHydrationScriptTags"
>;

/**
 * The inline script that hands a prerendered route's router the state it was
 * rendered with: router-core's bootstrap, the `$_TSR.router=` assignment, and
 * the `$_TSR.e()` that ends the stream, as one `<script>` with no attributes.
 *
 * router-core emits those sources for its own `<Scripts>` element to render,
 * split across tags marked as stream parts. A published fragment renders no
 * `<Scripts>` — compose places this script beside the route's markup itself —
 * so the parts are joined into the single script compose validates. Every
 * value the shell's loaders return is already resolved when the request
 * handler dehydrates, so the whole payload is queued by the time a render
 * callback runs; a payload missing its assignment or its completion is
 * refused rather than published as a document that never hydrates.
 */
export function takeRouterHydration(
  serverSsr: HydrationSource | undefined,
): string {
  const tags = serverSsr?.takeInitialHydrationScriptTags();
  const source = (tags?.before ?? [])
    .map((tag) => (typeof tag.children === "string" ? tag.children : ""))
    .filter((part) => part.length > 0)
    .join(";");
  const missing = [
    !source.includes("$_TSR.router=") && "its $_TSR.router assignment",
    !source.includes("$_TSR.e()") && "its $_TSR.e() completion",
  ].filter(Boolean);
  if (missing.length > 0)
    throw new Error(
      `TanStack Router's hydration payload lacks ${missing.join(" and ")}, so the prerendered route would never hydrate. Check that every route loader resolves before the router dehydrates, then rebuild the shell fragment.`,
    );
  return `<script>${source}</script>`;
}
