import { act, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

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
  evaluatesAModuleGraph,
  async () => {
    document.body.innerHTML = "<main></main>";

    await expect(import("./main")).rejects.toThrow("Missing remote root");
  },
);

test(
  "mounts the portfolio a visitor arriving at the remote came for",
  evaluatesAModuleGraph,
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
  evaluatesAModuleGraph,
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
  evaluatesAModuleGraph,
  async () => {
    await startRemote("?research-scenario=error");

    expect(
      screen.getByRole("heading", { name: "Research is unavailable" }),
    ).toBeInTheDocument();
  },
);

test(
  "holds the loading frame a visitor asks the remote to demonstrate",
  evaluatesAModuleGraph,
  async () => {
    await startRemote("?research-scenario=loading");

    expect(
      screen.getByRole("status", { name: "Loading research" }),
    ).toBeInTheDocument();
  },
);

test(
  "ignores a scenario the route does not offer",
  evaluatesAModuleGraph,
  async () => {
    await startRemote("?research-scenario=whatever");

    expect(
      screen.getByRole("heading", { level: 1, name: "Research Works" }),
    ).toBeInTheDocument();
  },
);
