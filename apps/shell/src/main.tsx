import { createBrowserHistory, RouterProvider } from "@tanstack/react-router";
import { RouterClient } from "@tanstack/react-router/ssr/client";
import { type ComponentType, StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import {
  createSiteRouter,
  entryRoutePath,
  loadBrowserDomain,
  type RoutePage,
  type RoutePages,
  rendersPrerenderedDocument,
  routePath,
} from "./router";
import "@site/design-system";

const root = document.getElementById("root");
if (!root) throw new Error("Missing application root");
const entryPath = entryRoutePath(root);

/**
 * Startup fetches one route's remote instead of the whole federation graph.
 * Only the page this document was rendered for has to be in hand to hydrate
 * it; the rest stay deferred, so their remoteEntry.js and chunks arrive when
 * the router preloads their route on hover intent.
 */
async function routePage<Props>(
  path: string,
  load: () => Promise<{ default: ComponentType<Props> }>,
): Promise<RoutePage<Props>> {
  return path === entryPath ? { component: (await load()).default } : { load };
}

const loadHome = () => import("home/Page");
const pages: RoutePages = {
  home: await routePage(routePath("Home"), loadHome),
  // Hover intent has to fetch the Home remote before its panes, because the
  // remote's own module owns the preload that resolves them.
  homePreload: async () => (await loadHome()).preload(),
  bio: await routePage(routePath("Bio"), () => import("bio/Page")),
  research: await routePage(
    routePath("Research"),
    () => import("research/Page"),
  ),
  software: await routePage(
    routePath("Software"),
    () => import("software/Page"),
  ),
  courses: await routePage(routePath("Courses"), () => import("courses/Page")),
};
const router = createSiteRouter({
  history: createBrowserHistory(),
  pages,
  context: { loadDomain: async (name) => loadBrowserDomain(name) as never },
});
function hasSerializedRouter(value: unknown): value is {
  router: Record<string, unknown>;
} {
  if (!value || typeof value !== "object") return false;
  const serializedRouter = Reflect.get(value, "router");
  return Boolean(serializedRouter && typeof serializedRouter === "object");
}
const hasStaticPayload = hasSerializedRouter(Reflect.get(window, "$_TSR"));
const canHydrate = hasStaticPayload && rendersPrerenderedDocument(router);
if (!canHydrate) await router.load();
const app = (
  <StrictMode>
    {canHydrate ? (
      <RouterClient router={router} />
    ) : (
      <RouterProvider router={router} />
    )}
  </StrictMode>
);
if (canHydrate) hydrateRoot(root, app);
else {
  root.replaceChildren();
  createRoot(root).render(app);
}
