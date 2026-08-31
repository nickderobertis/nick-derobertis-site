import { cvDataClient } from "@site/data-access-core/bundled";
import { act, screen } from "@testing-library/react";
import { prerender } from "react-dom/static";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import AwardsPage from "./page";

// `vi.resetModules()` makes every test below re-import its subject, evaluating
// that whole module graph again: 1.4s idle here, 12.6s under the contention
// `nx affected --parallel=3` puts the gate under, past Vitest's 5000ms default.
// Far past that rather than just past it, so it still bounds a genuine hang.
const moduleGraphCeiling = { timeout: 120_000 };

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
 * Starts the remote against an awards boundary that never answers. The
 * committed awards remain visible while the default request is pending, which
 * makes adopting the published fragment observable without a network race.
 */
async function startRemoteOnPendingAwards() {
  vi.stubGlobal("fetch", () => new Promise<Response>(() => {}));
  await act(async () => {
    await import("./main");
  });
}

function selectedPane() {
  return screen.getByRole("region", { name: "Selected awards" });
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
  moduleGraphCeiling,
  async () => {
    document.body.innerHTML = "<main></main>";

    await expect(import("./main")).rejects.toThrow("Missing remote root");
  },
);

test(
  "hydrates the published fragment into the awards a visitor came for",
  moduleGraphCeiling,
  async () => {
    document.body.innerHTML = `<div id="root">${await publishedFragment()}</div>`;
    expect(selectedPane()).toBeInTheDocument();

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
  moduleGraphCeiling,
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
  moduleGraphCeiling,
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
  "adopts the resolved awards a visitor is already looking at",
  moduleGraphCeiling,
  async () => {
    document.body.innerHTML = `<div id="root">${await publishedFragment()}</div>`;
    const published = selectedPane();

    await startRemoteOnPendingAwards();

    // Hydration takes over the shipped nodes in place, so the pane the visitor
    // has been watching since first paint is never torn down and repainted.
    expect(selectedPane()).toBe(published);
  },
);

test(
  "throws the published pane away when it was rendered for another view",
  moduleGraphCeiling,
  async () => {
    const fragment = await publishedFragment();
    window.history.replaceState(null, "", "/?awards-view=all");
    document.body.innerHTML = `<div id="root">${fragment}</div>`;
    const published = selectedPane();

    await startRemoteOnPendingAwards();

    // The fragment was published for the selected view. Adopting it would leave
    // one view's markup underneath another view's render, so this visitor's
    // pending frame has to be a fresh one.
    expect(published).not.toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Loading awards" }),
    ).toBeInTheDocument();
  },
);
