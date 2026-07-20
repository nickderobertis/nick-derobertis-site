export type AwardsRoute = "all" | "selected";

const routeByPath: Readonly<Record<string, AwardsRoute>> = {
  "/nick-derobertis-site": "selected",
  "/nick-derobertis-site/": "selected",
  "/nick-derobertis-site/awards": "all",
  "/nick-derobertis-site/awards/": "all",
  "/nick-derobertis-site/remotes/awards": "all",
  "/nick-derobertis-site/remotes/awards/": "all",
  "/nick-derobertis-site/remotes/awards/selected": "selected",
  "/nick-derobertis-site/remotes/awards/selected/": "selected",
};

export function parseAwardsRoute(pathname: string): AwardsRoute {
  const route = routeByPath[pathname];
  if (!route) throw new Error(`Unsupported awards route: ${pathname}`);
  return route;
}
