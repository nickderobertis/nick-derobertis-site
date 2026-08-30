// eslint-disable-next-line @nx/enforce-module-boundaries -- The shell owns site-base routing and reads only the base its own prerender wrote.
import { siteBase } from "@site/data-access-core/site";
import { prerenderRouteAttribute } from "@site/route-state";
import { routePath } from "./route-path";
import type { SiteRouter } from "./router";
import { routes } from "./routes";

/**
 * Reports the route the document in the browser was rendered for, so its page
 * can be resolved before hydration while every other route stays deferred. The
 * prerender step stamps the route on the root element; the pathname is the
 * fallback for a document it never stamped, such as the static 404 the server
 * returns for an unknown path. Returns undefined when no route owns the
 * location, leaving every page deferred for the router's redirect to resolve.
 */
export function entryRoutePath(root: Element): string | undefined {
  const stamped = root.getAttribute(prerenderRouteAttribute);
  const pathname = window.location.pathname.startsWith(siteBase)
    ? window.location.pathname.slice(siteBase.length)
    : window.location.pathname;
  const candidate = stamped ?? (pathname === "" ? "/" : pathname);
  return routes.find((route) => route.path === candidate)?.path;
}

/**
 * Reports whether the browser's location still renders the document the
 * prerender step produced, so the shell can hydrate it instead of discarding
 * it. Every route is prerendered with an empty query string, and the route
 * `validateSearch` in the router is what turns a query string into rendered
 * output: a view override genuinely changes the markup, while a tracking
 * parameter leaves it identical and must not cost the visitor their
 * prerendered HTML.
 *
 * Home is the conservative exception. Its panes are separate remotes that each
 * read their own state parameter straight from the URL rather than through
 * this router, so the shell cannot tell an inert parameter from a pane
 * override there.
 */
export function rendersPrerenderedDocument(router: SiteRouter): boolean {
  const { pathname, search } = router.state.location;
  const matches = router.matchRoutes(pathname, search);
  const leaf = matches[matches.length - 1];
  if (leaf?.fullPath === routePath("Home"))
    return Object.keys(search).length === 0;
  const deps: unknown = leaf?.loaderDeps;
  return (
    !deps ||
    typeof deps !== "object" ||
    !("view" in deps) ||
    deps.view === "default"
  );
}
