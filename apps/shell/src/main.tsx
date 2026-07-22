import { createBrowserHistory, RouterProvider } from "@tanstack/react-router";
import { RouterClient } from "@tanstack/react-router/ssr/client";
import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { createSiteRouter, loadBrowserDomain } from "./router";
import "@site/design-system";

const root = document.getElementById("root");
if (!root) throw new Error("Missing application root");
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
const hasStaticPayload = Boolean(
  Reflect.get(window, "$_TSR") &&
    Reflect.get(Reflect.get(window, "$_TSR") as object, "router"),
);
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
else createRoot(root).render(app);
