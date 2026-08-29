// The router the shell fragment entry's spec compiles it against. The publish
// build aliases `@site-fragment/router` to the shell's own `router.tsx`; this
// file is what that alias points at under Vitest, so the entry driving the SSR
// lifecycle is the real one while the app it prerenders stays inside this
// library's own tree — the same substitution the rspack compilation makes, and
// the reason nothing in this library's module graph points at an app.
//
// Every route here is built from the table in `./shell-fragment-routes.fixture`,
// which the entry loops over: the fixture states each path, page and loader
// domain once, so the routers it builds are the routes the entry renders.
// eslint-disable-next-line @nx/enforce-module-boundaries -- This fixture is a build-only alias target for the shell fragment entry's spec, and takes the site base from the same module the shell router takes it from.
import { siteBase } from "@site/data-access-core";
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  useMatches,
} from "@tanstack/react-router";
import type { FunctionComponent } from "react";
import {
  type FragmentDomainName,
  type FragmentPageName,
  routes,
} from "./shell-fragment-routes.fixture";

export interface FragmentPage {
  component: FunctionComponent;
}

export type FragmentPages = Record<FragmentPageName, FragmentPage>;

export interface FragmentRouterContext {
  loadDomain: <Name extends FragmentDomainName>(name: Name) => Promise<unknown>;
}

let failingRouteId: string | undefined;

/**
 * Makes the router for the named route fail while it renders, so a spec can
 * drive the entry's failure path. Passing `undefined` restores every route.
 */
export function failRenderingRoute(routeId: string | undefined) {
  failingRouteId = routeId;
}

function FragmentRoot() {
  const routeId = useMatches().at(-1)?.routeId;
  // Thrown from the root route, which the router wraps in neither a catch
  // boundary nor the Suspense boundary its Outlet puts around child routes. A
  // child route's throw is recoverable — React abandons that subtree's server
  // render and defers it to the client — while this one reaches `prerender` as
  // the render failure the entry has to clean up after.
  if (routeId !== undefined && routeId === failingRouteId)
    throw new Error(`The ${routeId} page failed to render.`);
  return (
    <main>
      <Outlet />
    </main>
  );
}

export function createSiteRouter({
  pages,
  context,
}: {
  pages: FragmentPages;
  context: FragmentRouterContext;
}) {
  const Root = createRootRouteWithContext<FragmentRouterContext>()({
    component: FragmentRoot,
  });
  const children = routes.map(({ path, page, domain }) =>
    createRoute({
      getParentRoute: () => Root,
      path,
      component: pages[page].component,
      ...(domain === undefined
        ? {}
        : {
            loader: ({ context: ctx }: { context: FragmentRouterContext }) =>
              ctx.loadDomain(domain),
          }),
    }),
  );
  const routeTree = Root.addChildren(children);
  return createRouter({ routeTree, context, basepath: siteBase });
}
