import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import { routes } from "./routes";
import { SiteRoot } from "./site-root";

/**
 * The chrome is a route component, so it is driven through a router the way the
 * shell mounts it. Only the outlet's contents differ from the real tree.
 */
async function renderChrome() {
  const root = createRootRoute({ component: SiteRoot });
  const index = createRoute({
    getParentRoute: () => root,
    path: "/",
    component: () => <h1>Route content</h1>,
  });
  const router = createRouter({
    routeTree: root.addChildren([index]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await router.load();
  render(<RouterProvider router={router} />);
}

test("wraps a route's content in the site's header, navigation, and footer", async () => {
  await renderChrome();

  expect(screen.getByRole("banner")).toBeInTheDocument();
  expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  expect(
    within(screen.getByRole("main")).getByRole("heading", {
      name: "Route content",
    }),
  ).toBeInTheDocument();
});

test("offers every published route in the primary navigation", async () => {
  await renderChrome();

  const nav = screen.getByRole("navigation", { name: "Primary" });
  expect(
    within(nav)
      .getAllByRole("link")
      .map((link) => link.textContent),
  ).toEqual(routes.map((route) => route.label));
  // The brand mark is a way home that sits outside the route list.
  expect(
    screen.getByRole("link", { name: "Nick DeRobertis" }),
  ).toBeInTheDocument();
});
