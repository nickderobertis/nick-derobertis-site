import { act, screen } from "@testing-library/react";
import { prerender } from "react-dom/static";
import { beforeEach, expect, test, vi } from "vitest";
import TimelinePage from "./page";

// `vi.resetModules()` makes every test below re-import its subject, evaluating
// that whole module graph again: 1.4s idle here, 12.6s under the contention
// `nx affected --parallel=3` puts the gate under, past Vitest's 5000ms default.
// Far past that rather than just past it, so it still bounds a genuine hang.
const moduleGraphCeiling = { timeout: 120_000 };

/**
 * The markup the remote's build publishes into its own index.html. Producing it
 * from the page itself is what makes the hydration below the real one: a
 * hand-written stand-in would prove nothing about the bytes a visitor receives.
 */
async function publishedFragment() {
  // The build prerenders without a browser, so the fragment every visitor is
  // served carries the settled history whatever query they later arrive with.
  vi.stubGlobal("window", undefined);
  const { prelude } = await prerender(<TimelinePage />);
  const html = await new Response(prelude).text();
  vi.unstubAllGlobals();
  return html;
}

async function startRemote() {
  await act(async () => {
    await import("./main");
  });
}

function pane() {
  return screen.getByRole("region", { name: "Educated and Experienced" });
}

beforeEach(() => {
  vi.resetModules();
  document.body.innerHTML = "";
  window.history.replaceState(null, "", "/");
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
  "adopts the published history a visitor is already looking at",
  moduleGraphCeiling,
  async () => {
    document.body.innerHTML = `<div id="root">${await publishedFragment()}</div>`;
    const published = pane();

    await startRemote();

    // Hydration takes over the shipped nodes in place, so the chart the visitor
    // has been looking at since first paint is never torn down and repainted.
    expect(pane()).toBe(published);
    expect(
      screen.getByRole("checkbox", { name: "Employment" }),
    ).toBeInTheDocument();
  },
);

test(
  "renders from scratch when the document ships no prerendered history",
  moduleGraphCeiling,
  async () => {
    document.body.innerHTML = '<div id="root"></div>';

    await startRemote();

    expect(
      await screen.findByRole("region", { name: "Educated and Experienced" }),
    ).toBeInTheDocument();
  },
);

test(
  "throws the published history away when another state was asked for",
  moduleGraphCeiling,
  async () => {
    window.history.replaceState(null, "", "/?timeline-state=error");
    document.body.innerHTML = `<div id="root">${await publishedFragment()}</div>`;
    const published = pane();

    await startRemote();

    // The fragment was published for the settled history. Adopting it would leave
    // one state's markup underneath another state's render, so it has to go.
    expect(published).not.toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Timeline unavailable",
    );
  },
);
