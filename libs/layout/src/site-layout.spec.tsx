import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SiteLayout } from "./site-layout";

describe("SiteLayout", () => {
  it("renders accessible shared navigation and content", async () => {
    const root = createRootRoute();
    const index = createRoute({
      getParentRoute: () => root,
      path: "/",
      component: () => (
        <SiteLayout routes={[{ path: "/", label: "Home" }]}>
          <h1>Page</h1>
        </SiteLayout>
      ),
    });
    const router = createRouter({
      routeTree: root.addChildren([index]),
      history: createMemoryHistory({ initialEntries: ["/"] }),
    });
    await router.load();
    render(<RouterProvider router={router} />);
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeTruthy();
    expect(screen.getByRole("main").getAttribute("tabindex")).toBe("-1");
    expect(screen.getByRole("heading", { name: "Page" })).toBeTruthy();
    expect(screen.getByRole("contentinfo").textContent).toContain(
      "Nick DeRobertis",
    );
  });
});
