import { act, screen } from "@testing-library/react";
import { prerender } from "react-dom/static";
import { beforeEach, expect, test, vi } from "vitest";
import HomeContactPage from "./page";

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
 * The markup the remote's build publishes into its own index.html. It is
 * produced from the page itself, with no window to read a preview query from,
 * so the hydration below is the real one rather than a hand-written stand-in.
 */
async function publishedFragment() {
  vi.stubGlobal("window", undefined);
  const { prelude } = await prerender(<HomeContactPage />);
  const html = await new Response(prelude).text();
  vi.unstubAllGlobals();
  return html;
}

async function startRemote() {
  await act(async () => {
    await import("./main");
  });
}

function channels() {
  return screen.getByRole("navigation", { name: "Contact options" });
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
  "adopts the contact options a visitor is already looking at",
  evaluatesAModuleGraph,
  async () => {
    document.body.innerHTML = `<div id="root">${await publishedFragment()}</div>`;
    const published = channels();

    await startRemote();

    // Hydration takes over the shipped nodes in place, so the channels the
    // visitor saw at first paint are never torn down and repainted.
    expect(channels()).toBe(published);
    expect(
      screen.getByRole("link", { name: "Email Nick →" }),
    ).toBeInTheDocument();
  },
);

test(
  "renders from scratch when the document ships no prerendered options",
  evaluatesAModuleGraph,
  async () => {
    document.body.innerHTML = '<div id="root"></div>';

    await startRemote();

    // Nothing was shipped to adopt, so the pane arrives behind Suspense with the
    // skeleton standing in until its page chunk resolves.
    expect(
      await screen.findByRole("navigation", { name: "Contact options" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  },
);

test(
  "throws the published options away for a visitor previewing another state",
  evaluatesAModuleGraph,
  async () => {
    window.history.replaceState(null, "", "/?state=empty");
    document.body.innerHTML = `<div id="root">${await publishedFragment()}</div>`;
    const published = channels();

    await startRemote();

    // The fragment was published for the happy pane. Adopting it would leave one
    // state's markup underneath another state's render.
    expect(published).not.toBeInTheDocument();
    expect(
      await screen.findByText("No contact options are available."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  },
);
