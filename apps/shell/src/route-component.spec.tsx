import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { expect, test } from "vitest";
import { type RoutePage, routeComponent } from "./route-component";

function Greeting({ name }: { name: string }) {
  return <h1>Hello {name}</h1>;
}

/**
 * Mounts an adapted page the way the router mounts one, so a deferred page goes
 * through the same fetch-then-render the router performs on navigation.
 */
async function mountRoute(page: RoutePage<{ name: string }>) {
  const root = createRootRoute();
  const index = createRoute({
    getParentRoute: () => root,
    path: "/",
    component: routeComponent(page, (Page: ComponentType<{ name: string }>) => (
      <Page name="visitor" />
    )),
  });
  const router = createRouter({
    routeTree: root.addChildren([index]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await router.load();
  render(<RouterProvider router={router} />);
}

test("renders a page the caller already had in hand", async () => {
  await mountRoute({ component: Greeting });

  expect(
    await screen.findByRole("heading", { name: "Hello visitor" }),
  ).toBeInTheDocument();
});

test("leaves a deferred page for the router to fetch, then renders it", async () => {
  let fetched = 0;

  await mountRoute({
    load: async () => {
      fetched += 1;
      return { default: Greeting };
    },
  });

  expect(
    await screen.findByRole("heading", { name: "Hello visitor" }),
  ).toBeInTheDocument();
  // The router owns the fetch, so the chunk is asked for once per match rather
  // than on every render of the page inside it.
  expect(fetched).toBe(1);
});
