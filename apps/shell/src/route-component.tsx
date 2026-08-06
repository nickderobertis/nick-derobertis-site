import {
  lazyRouteComponent,
  type RouteComponent,
} from "@tanstack/react-router";
import type { ComponentType, ReactElement } from "react";

/**
 * A route's page. `component` is a page the caller already resolved — every
 * route during server rendering, and the entry route in the browser, which has
 * to be in hand before hydration. `load` defers the page to the router, which
 * fetches it when the route is preloaded or navigated to.
 */
export type RoutePage<Props> =
  | { component: ComponentType<Props> }
  | { load: () => Promise<{ default: ComponentType<Props> }> };

/**
 * Adapts a page to the route component that renders it from loader data. A
 * deferred page becomes a lazyRouteComponent, so the router owns fetching it:
 * `defaultPreload: "intent"` calls its `preload()` alongside the route's loader
 * on hover, and a match only settles once that chunk has arrived.
 */
export function routeComponent<Props>(
  page: RoutePage<Props>,
  render: (Page: ComponentType<Props>) => ReactElement,
): RouteComponent {
  if ("component" in page) {
    const Page = page.component;
    return () => render(Page);
  }
  const { load } = page;
  return lazyRouteComponent(async () => {
    const { default: Page } = await load();
    return { default: () => render(Page) };
  });
}
