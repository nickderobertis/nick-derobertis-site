import { act, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

// `vi.resetModules()` makes every test below re-import its subject, evaluating
// that whole module graph again: 1.4s idle here, 12.6s under the contention
// `nx affected --parallel=3` puts the gate under, past Vitest's 5000ms default.
// Far past that rather than just past it, so it still bounds a genuine hang.
const evaluatesAModuleGraph = { timeout: 120_000 };

/**
 * Starts the remote the way its own index.html does: the entry reads the view
 * from the address bar and mounts the page itself, so nothing below the
 * document is stood in for here.
 */
async function startRemote(search = "") {
  window.history.replaceState(null, "", `/${search}`);
  document.body.innerHTML = '<div id="root"></div>';
  await act(async () => {
    await import("./main");
    // The entry mounts the page lazily behind a Suspense boundary, so settling
    // that same module here is what makes the assertions below about the
    // mounted page — rather than about how fast this machine resolved a chunk.
    await import("./page");
  });
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
  "mounts the biography a visitor arriving at the remote came for",
  evaluatesAModuleGraph,
  async () => {
    await startRemote();

    expect(
      screen.getByRole("heading", { level: 1, name: "Optimizing Life" }),
    ).toBeInTheDocument();
  },
);

test(
  "shows the empty state to a visitor who steers the remote into it",
  evaluatesAModuleGraph,
  async () => {
    await startRemote("?bio-view=empty");

    expect(
      screen.getByRole("heading", { name: "Biography coming soon" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  },
);

test(
  "shows the error state to a visitor who steers the remote into it",
  evaluatesAModuleGraph,
  async () => {
    await startRemote("?bio-view=error");

    expect(
      screen.getByRole("heading", { name: "Biography unavailable" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  },
);

test(
  "ignores a view the route does not offer",
  evaluatesAModuleGraph,
  async () => {
    await startRemote("?bio-view=whatever");

    expect(
      screen.getByRole("heading", { level: 1, name: "Optimizing Life" }),
    ).toBeInTheDocument();
  },
);
