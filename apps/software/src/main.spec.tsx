import { act, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

/**
 * Every test here imports the remote's entry, and `vi.resetModules()` makes
 * each pay for that import afresh, so what each is bounded by is the remote's
 * whole module graph being evaluated — a cost that tracks the workspace's size
 * and the machine's load rather than the test's own work, and one the runner's
 * 5000ms default sits inside once `nx affected --parallel=3` contends for the
 * CPU. The ceiling is set far past what that import can cost rather than past
 * the contention of the day, so it still bounds a genuine hang.
 */
const entryImportCeiling = { timeout: 120_000 };

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
  entryImportCeiling,
  async () => {
    document.body.innerHTML = "<main></main>";

    await expect(import("./main")).rejects.toThrow("Missing remote root");
  },
);

test(
  "mounts the portfolio a visitor arriving at the remote came for",
  entryImportCeiling,
  async () => {
    await startRemote();

    expect(
      screen.getByRole("region", { name: "Software projects" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("article").length).toBeGreaterThan(1);
  },
);

test(
  "shows the empty state to a visitor who steers the remote into it",
  entryImportCeiling,
  async () => {
    await startRemote("?software-view=empty");

    expect(
      screen.getByRole("heading", {
        name: "No software projects to show",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  },
);

test(
  "shows the error state to a visitor who steers the remote into it",
  entryImportCeiling,
  async () => {
    await startRemote("?software-view=error");

    expect(
      screen.getByRole("heading", {
        name: "Software projects are unavailable",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  },
);

test(
  "ignores a view the route does not offer",
  entryImportCeiling,
  async () => {
    await startRemote("?software-view=whatever");

    expect(
      screen.getByRole("region", { name: "Software projects" }),
    ).toBeInTheDocument();
  },
);
