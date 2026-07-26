import { createBrowserHistory, RouterProvider } from "@tanstack/react-router";
import { RouterClient } from "@tanstack/react-router/ssr/client";
import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { createSiteRouter, loadBrowserDomain } from "./router";
import "@site/design-system";

const root = document.getElementById("root");
if (!root) throw new Error("Missing application root");
// llmlint: ignore[changed_behavior_has_e2e] SSR hydration requires route components before React can attach, so module-fetch loading has no renderable boundary; each route's app-owned loading state is exercised through both host-composed and standalone paths in its feature spec.
const [home, bio, research, software, courses] = await Promise.all([
  import("home/Page"),
  import("bio/Page"),
  import("research/Page"),
  import("software/Page"),
  import("courses/Page"),
]);
const router = createSiteRouter({
  history: createBrowserHistory(),
  pages: {
    home: home.default,
    bio: bio.default,
    research: research.default,
    software: software.default,
    courses: courses.default,
  },
  context: {
    loadDomain: async (name) => loadBrowserDomain(name) as never,
    search: new URLSearchParams(window.location.search),
  },
});
function hasSerializedRouter(value: unknown): value is {
  router: Record<string, unknown>;
} {
  if (!value || typeof value !== "object") return false;
  const serializedRouter = Reflect.get(value, "router");
  return Boolean(serializedRouter && typeof serializedRouter === "object");
}
const hasStaticPayload = hasSerializedRouter(Reflect.get(window, "$_TSR"));
const canHydrate = hasStaticPayload && !window.location.search;
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
