import { act, fireEvent, screen } from "@testing-library/react";
import { prerender } from "react-dom/static";
import { beforeEach, expect, test, vi } from "vitest";
import HomeCarouselPage from "./page";

// `vi.resetModules()` makes every test below re-import its subject, evaluating
// that whole module graph again: 1.4s idle here, 12.6s under the contention
// `nx affected --parallel=3` puts the gate under, past Vitest's 5000ms default.
// Far past that rather than just past it, so it still bounds a genuine hang.
const evaluatesAModuleGraph = { timeout: 120_000 };

/**
 * The markup the remote's build publishes into its own index.html. It is
 * produced from the page itself, with no window to read a preview query from,
 * so the hydration below is the real one rather than a hand-written stand-in.
 */
async function publishedFragment() {
  vi.stubGlobal("window", undefined);
  const { prelude } = await prerender(<HomeCarouselPage />);
  const html = await new Response(prelude).text();
  vi.unstubAllGlobals();
  return html;
}

async function startRemote() {
  await act(async () => {
    await import("./main");
  });
}

function carousel() {
  return screen.getByRole("region", { name: "Featured work" });
}

beforeEach(() => {
  vi.resetModules();
  document.body.innerHTML = "";
  window.history.replaceState(null, "", "/");
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
  "adopts the story a visitor is already looking at and makes it work",
  evaluatesAModuleGraph,
  async () => {
    document.body.innerHTML = `<div id="root">${await publishedFragment()}</div>`;
    const published = carousel();

    await startRemote();

    // Hydration takes over the shipped nodes in place, so the story the visitor
    // saw at first paint is never torn down and repainted — and the controls the
    // published markup could not wire up now move it.
    expect(carousel()).toBe(published);
    fireEvent.click(
      screen.getByRole("button", { name: "Next featured story" }),
    );
    expect(screen.getByText("Story 2 of 2")).toBeInTheDocument();
  },
);

test(
  "renders from scratch when the document ships no prerendered story",
  evaluatesAModuleGraph,
  async () => {
    document.body.innerHTML = '<div id="root"></div>';

    await startRemote();

    // Nothing was shipped to adopt, so the pane arrives behind Suspense with the
    // skeleton standing in until its page chunk resolves.
    expect(
      await screen.findByRole("region", { name: "Featured work" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  },
);

test(
  "throws the published story away for a visitor previewing another state",
  evaluatesAModuleGraph,
  async () => {
    window.history.replaceState(null, "", "/?state=error");
    document.body.innerHTML = `<div id="root">${await publishedFragment()}</div>`;
    const published = carousel();

    await startRemote();

    // The fragment was published for the happy pane. Adopting it would leave one
    // state's markup underneath another state's render.
    expect(published).not.toBeInTheDocument();
    expect(
      await screen.findByText("Featured stories could not be loaded."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  },
);
