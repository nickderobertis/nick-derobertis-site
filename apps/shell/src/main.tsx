import { createBrowserHistory } from "@tanstack/react-router";
import { StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { App } from "./app";
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
    loadDomain: async (name) => {
      const dehydrated =
        document.getElementById("__TSR_DEHYDRATED__")?.textContent;
      if (dehydrated) {
        const domains = JSON.parse(dehydrated) as Record<string, unknown>;
        if (name in domains) return domains[name] as never;
      }
      return loadBrowserDomain(name) as never;
    },
    search: new URLSearchParams(window.location.search),
  },
});
await router.load();
hydrateRoot(
  root,
  <StrictMode>
    <App router={router} />
  </StrictMode>,
);
