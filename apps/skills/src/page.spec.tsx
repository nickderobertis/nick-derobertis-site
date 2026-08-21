import { cvDataClient } from "@site/data-access-core";
import { buildSkillTree } from "@site/data-access-skills";
import { render, screen } from "@testing-library/react";
import { prerender } from "react-dom/static";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

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

const tree = buildSkillTree(cvDataClient.domain("skills"));

async function renderPane() {
  const { default: SkillsPage } = await import("./page");
  return render(<SkillsPage />);
}

function openWith(query: string) {
  window.history.replaceState(null, "", query);
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
  "renders the CV's whole skill tree for a visitor who just arrives",
  evaluatesAModuleGraph,
  async () => {
    await renderPane();

    expect(
      screen.getByRole("region", { name: "Skilled in…" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(`Browse ${tree.skillCount} skills`, { exact: false }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Skills sunburst chart" }),
    ).toBeInTheDocument();
  },
);

test(
  "holds the loading frame for a visitor steering the pane into it",
  evaluatesAModuleGraph,
  async () => {
    openWith("/?skills-state=loading");

    await renderPane();

    expect(
      screen.getByRole("status", { name: "Loading skills" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("img", { name: "Skills sunburst chart" }),
    ).not.toBeInTheDocument();
  },
);

test(
  "reports a CV with no skills as a status rather than an empty chart",
  evaluatesAModuleGraph,
  async () => {
    openWith("/?skills-state=empty");

    await renderPane();

    expect(screen.getByRole("status")).toHaveTextContent(
      "No skills are available.",
    );
    expect(
      screen.queryByRole("img", { name: "Skills sunburst chart" }),
    ).not.toBeInTheDocument();
  },
);

test(
  "reports unavailable skills as an alert",
  evaluatesAModuleGraph,
  async () => {
    openWith("/?skills-state=error");

    await renderPane();

    expect(screen.getByRole("alert")).toHaveTextContent("Skills unavailable");
    expect(
      screen.queryByRole("img", { name: "Skills sunburst chart" }),
    ).not.toBeInTheDocument();
  },
);

test(
  "ignores a steer it has no state for and shows the tree",
  evaluatesAModuleGraph,
  async () => {
    openWith("/?skills-state=not-a-skills-state");

    await renderPane();

    expect(
      screen.getByRole("region", { name: "Skilled in…" }),
    ).toBeInTheDocument();
  },
);

test(
  "prerenders the settled tree the built fragment ships",
  evaluatesAModuleGraph,
  async () => {
    const { default: SkillsPage } = await import("./page");
    vi.stubGlobal("window", undefined);

    const { prelude } = await prerender(<SkillsPage />);
    const html = await new Response(prelude).text();

    vi.unstubAllGlobals();
    // The build writes this markup straight into the published fragment, so parse
    // it the way a browser does before asking what a visitor finds in it.
    document.body.innerHTML = html;
    expect(
      screen.getByRole("region", { name: "Skilled in…" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Explore Programming category" }),
    ).toBeInTheDocument();
  },
);
