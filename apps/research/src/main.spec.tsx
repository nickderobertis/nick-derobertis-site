import { act, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

// `vi.resetModules()` makes every test below re-import its subject, evaluating
// that whole module graph again: 1.4s idle here, 12.6s under the contention
// `nx affected --parallel=3` puts the gate under, past Vitest's 5000ms default.
// Far past that rather than just past it, so it still bounds a genuine hang.
const moduleGraphCeiling = { timeout: 120_000 };

/**
 * Starts the remote the way its own index.html does: the entry reads the
 * scenario from the address bar and mounts the page itself, so nothing below
 * the document is stood in for here.
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
  moduleGraphCeiling,
  async () => {
    document.body.innerHTML = "<main></main>";

    await expect(import("./main")).rejects.toThrow("Missing remote root");
  },
);

test(
  "mounts the portfolio a visitor arriving at the remote came for",
  moduleGraphCeiling,
  async () => {
    await startRemote();

    expect(
      screen.getByRole("heading", { level: 1, name: "Research Works" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Working Papers" }),
    ).toBeInTheDocument();
  },
);

test(
  "shows the empty collection to a visitor who steers the remote into it",
  moduleGraphCeiling,
  async () => {
    await startRemote("?research-scenario=empty");

    expect(
      screen.getByRole("heading", { name: "No research projects yet" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Working Papers" }),
    ).not.toBeInTheDocument();
  },
);

test(
  "shows the failed collection to a visitor who steers the remote into it",
  moduleGraphCeiling,
  async () => {
    await startRemote("?research-scenario=error");

    expect(
      screen.getByRole("heading", { name: "Research is unavailable" }),
    ).toBeInTheDocument();
  },
);

test(
  "holds the loading frame a visitor asks the remote to demonstrate",
  moduleGraphCeiling,
  async () => {
    await startRemote("?research-scenario=loading");

    expect(
      screen.getByRole("status", { name: "Loading research" }),
    ).toBeInTheDocument();
  },
);

test(
  "ignores a scenario the route does not offer",
  moduleGraphCeiling,
  async () => {
    await startRemote("?research-scenario=whatever");

    expect(
      screen.getByRole("heading", { level: 1, name: "Research Works" }),
    ).toBeInTheDocument();
  },
);
