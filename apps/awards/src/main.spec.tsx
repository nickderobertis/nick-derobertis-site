import { cvDataClient } from "@site/data-access-core";
import { act, screen } from "@testing-library/react";
import { prerender } from "react-dom/static";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import AwardsPage from "./page";

/**
 * The ceiling every test below is held to, because each reaches its subject
 * through `await import(...)` and `vi.resetModules()` makes it pay for that
 * import afresh rather than reusing the last test's evaluation. What that costs
 * is the subject's whole transitive graph being evaluated again — a cost set by
 * the workspace's size and the host's load, not by this file: 90ms to 1.4s per
 * test measured idle, reaching 5.6s and then 12.6s under the contention
 * `nx affected --parallel=3` puts the gate under, which is past the runner's
 * 5000ms default. It is set far past anything that import can cost rather than
 * past today's contention — one chosen to clear a busy evening fails again on a
 * busier one — so it still bounds a genuine hang and nothing else.
 */
const evaluatesAModuleGraph = { timeout: 120_000 };

const awards = cvDataClient.domain("awards");

/**
 * The markup the remote's build publishes into its own index.html. Producing it
 * from the page itself is what makes the hydration below the real one: a
 * hand-written stand-in would prove nothing about the bytes a visitor receives.
 */
async function publishedFragment() {
  const { prelude } = await prerender(<AwardsPage />);
  return await new Response(prelude).text();
}

async function startRemote() {
  vi.stubGlobal(
    "fetch",
    async () =>
      new Response(JSON.stringify(awards), {
        headers: { "content-type": "application/json" },
      }),
  );
  await act(async () => {
    await import("./main");
  });
}

/**
 * Starts the remote against an awards boundary that never answers, holding the
 * pane on its loading frame. That frame is the only moment at which adopting
 * the published fragment and throwing it away look different in the document:
 * once the awards arrive, both paths have replaced it with the same pane.
 */
async function startRemoteOnPendingAwards() {
  vi.stubGlobal("fetch", () => new Promise<Response>(() => {}));
  await act(async () => {
    await import("./main");
  });
}

function loadingFrame() {
  return screen.getByRole("status", { name: "Loading awards" });
}

beforeEach(() => {
  vi.resetModules();
  document.body.innerHTML = "";
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test(
  "refuses to start against a document with no remote root",
  evaluatesAModuleGraph,
  async () => {
    document.body.innerHTML = "<main></main>";

    await expect(import("./main")).rejects.toThrow("Missing remote root");
  },
);

test(
  "hydrates the published fragment into the awards a visitor came for",
  evaluatesAModuleGraph,
  async () => {
    document.body.innerHTML = `<div id="root">${await publishedFragment()}</div>`;
    expect(
      screen.getByRole("status", { name: "Loading awards" }),
    ).toBeInTheDocument();

    await startRemote();

    expect(
      await screen.findByRole("region", { name: "Selected awards" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("status", { name: "Loading awards" }),
    ).not.toBeInTheDocument();
  },
);

test(
  "renders from scratch when the document ships no prerendered awards",
  evaluatesAModuleGraph,
  async () => {
    document.body.innerHTML = '<div id="root"></div>';

    await startRemote();

    expect(
      await screen.findByRole("region", { name: "Selected awards" }),
    ).toBeInTheDocument();
  },
);

test(
  "shows the complete set to a visitor who arrives asking for it",
  evaluatesAModuleGraph,
  async () => {
    // The published fragment can only ever settle onto the selected view, so a
    // visitor arriving with a query has to be given what they asked for instead.
    window.history.replaceState(null, "", "/?awards-view=all");
    document.body.innerHTML = `<div id="root">${await publishedFragment()}</div>`;

    await startRemote();

    expect(
      await screen.findByRole("region", { name: "Awards & honors" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Selected awards" }),
    ).not.toBeInTheDocument();
  },
);

test(
  "adopts the loading frame a visitor is already looking at",
  evaluatesAModuleGraph,
  async () => {
    document.body.innerHTML = `<div id="root">${await publishedFragment()}</div>`;
    const published = loadingFrame();

    await startRemoteOnPendingAwards();

    // Hydration takes over the shipped nodes in place, so the frame the visitor
    // has been watching since first paint is never torn down and repainted.
    expect(loadingFrame()).toBe(published);
  },
);

test(
  "throws the published frame away when it was rendered for another view",
  evaluatesAModuleGraph,
  async () => {
    window.history.replaceState(null, "", "/?awards-view=all");
    document.body.innerHTML = `<div id="root">${await publishedFragment()}</div>`;
    const published = loadingFrame();

    await startRemoteOnPendingAwards();

    // The fragment was published for the selected view. Adopting it would leave
    // one view's markup underneath another view's render, so this visitor's
    // frame has to be a fresh one.
    expect(published).not.toBeInTheDocument();
    expect(loadingFrame()).not.toBe(published);
  },
);
