import { cvDataClient } from "@site/data-access-core/bundled";
import { buildSkillTree } from "@site/data-access-skills";
import { render, screen } from "@testing-library/react";
import { prerender } from "react-dom/static";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

// `vi.resetModules()` makes every test below re-import its subject, evaluating
// that whole module graph again: 1.4s idle here, 12.6s under the contention
// `nx affected --parallel=3` puts the gate under, past Vitest's 5000ms default.
// Far past that rather than just past it, so it still bounds a genuine hang.
const moduleGraphCeiling = { timeout: 120_000 };

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
  moduleGraphCeiling,
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
  moduleGraphCeiling,
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
  moduleGraphCeiling,
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

test("reports unavailable skills as an alert", moduleGraphCeiling, async () => {
  openWith("/?skills-state=error");

  await renderPane();

  expect(screen.getByRole("alert")).toHaveTextContent("Skills unavailable");
  expect(
    screen.queryByRole("img", { name: "Skills sunburst chart" }),
  ).not.toBeInTheDocument();
});

test(
  "ignores a steer it has no state for and shows the tree",
  moduleGraphCeiling,
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
  moduleGraphCeiling,
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
