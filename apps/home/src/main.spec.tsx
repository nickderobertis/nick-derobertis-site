import { cvDataClient } from "@site/data-access-core";
import { act, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

/**
 * Stands in for the Pages host that serves the CV domains, which is the awards
 * pane's only boundary — and the only pane of the seven that fetches at all.
 */
function serveAwards() {
  vi.stubGlobal(
    "fetch",
    async () =>
      new Response(JSON.stringify(cvDataClient.domain("awards")), {
        headers: { "content-type": "application/json" },
      }),
  );
}

async function startRemote() {
  await act(async () => {
    await import("./main");
  });
}

/**
 * The panes arrive on module promises the page module creates once, so how long
 * the mounted remote stays suspended is how long the runner takes to load seven
 * pane modules — which a loaded machine pushes past Testing Library's one-second
 * wall clock. Awaiting the very promises the mounted page is suspended on settles
 * the frame on that work instead of on a timer. The page read its render path at
 * mount, so it stays on the Suspense branch this covers.
 */
async function settlePanes() {
  const { preload } = await import("./panes");
  await act(preload);
}

beforeEach(() => {
  vi.resetModules();
  document.body.innerHTML = "";
  window.history.replaceState(null, "", "/");
  serveAwards();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("refuses to start against a document with no remote root", async () => {
  document.body.innerHTML = "<main></main>";

  await expect(import("./main")).rejects.toThrow("Missing remote root");
});

test("holds the composed page's own loading frame until it arrives", async () => {
  document.body.innerHTML = '<div id="root"></div>';

  await startRemote();
  await settlePanes();

  expect(
    await screen.findByRole("region", { name: "Featured work" }),
  ).toBeInTheDocument();
  expect(
    await screen.findByRole("region", { name: "Educated and Experienced" }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("status", { name: "Loading home" })).toBeNull();
});
