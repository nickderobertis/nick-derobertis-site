import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from "@tanstack/react-router";
import {
  createRequestHandler,
  RouterServer,
} from "@tanstack/react-router/ssr/server";
import { prerender } from "react-dom/static";
import { expect, test } from "vitest";
import { takeRouterHydration } from "./router-hydration";

function siteRouter() {
  const rootRoute = createRootRoute({ component: Outlet });
  const page = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    loader: () => ({ view: "default" }),
    component: () => <main>page</main>,
  });
  return createRouter({ routeTree: rootRoute.addChildren([page]) });
}

/** One request through router-core's real handler, as the fragment entry runs it. */
async function hydrationFor(
  hydrationSource: Parameters<typeof takeRouterHydration>[0],
) {
  let hydration = "";
  await createRequestHandler({
    request: new Request("https://fragment.invalid/"),
    createRouter: siteRouter,
  })(async ({ router }) => {
    const { prelude } = await prerender(<RouterServer router={router} />);
    router.serverSsr?.setRenderFinished();
    hydration = takeRouterHydration(hydrationSource ?? router.serverSsr);
    return new Response(await new Response(prelude).text());
  });
  return hydration;
}

test("a dehydrated router's payload is one bare script that assigns the router and ends the stream", async () => {
  const hydration = await hydrationFor(undefined);
  const parsed = document.createElement("div");
  parsed.innerHTML = hydration;

  expect(parsed.children).toHaveLength(1);
  const [script] = parsed.children;
  expect(script?.tagName).toBe("SCRIPT");
  expect(script?.attributes).toHaveLength(0);
  expect(script?.textContent).toContain("$_TSR.router=");
  expect(script?.textContent).toContain('view:"default"');
  expect(script?.textContent).toContain("$_TSR.e()");
});

test("a payload already taken, or missing its completion, is refused rather than published", async () => {
  await expect(
    hydrationFor({ takeInitialHydrationScriptTags: () => undefined }),
  ).rejects.toThrow(
    "lacks its $_TSR.router assignment and its $_TSR.e() completion",
  );
  await expect(
    hydrationFor({
      takeInitialHydrationScriptTags: () => ({
        before: [
          { tag: "script", children: "$_TSR.router=1" },
          { tag: "script" },
        ],
        boundary: { tag: "script" },
      }),
    }),
  ).rejects.toThrow(/lacks its \$_TSR\.e\(\) completion, so/);
});
