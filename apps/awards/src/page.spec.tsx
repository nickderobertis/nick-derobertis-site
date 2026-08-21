import { cvDataClient } from "@site/data-access-core";
import { render, screen, within } from "@testing-library/react";
import { prerender } from "react-dom/static";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

// `vi.resetModules()` makes every test below re-import its subject, evaluating
// that whole module graph again: 1.4s idle here, 12.6s under the contention
// `nx affected --parallel=3` puts the gate under, past Vitest's 5000ms default.
// Far past that rather than just past it, so it still bounds a genuine hang.
const evaluatesAModuleGraph = { timeout: 120_000 };

const awards = cvDataClient.domain("awards");

/**
 * Stands in for the Pages host that serves the CV domains — the pane's only
 * boundary. Everything below it, including the pane itself, is the real thing.
 */
function serveAwards(body: unknown, status = 200) {
  vi.stubGlobal(
    "fetch",
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
  );
}

async function renderPane() {
  const { default: AwardsPage } = await import("./page");
  return render(<AwardsPage />);
}

function statistics(pane: HTMLElement) {
  return within(pane)
    .getAllByRole("definition")
    .map((definition) => definition.textContent);
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
  "settles from its loading frame onto the selected awards",
  evaluatesAModuleGraph,
  async () => {
    serveAwards(awards);

    await renderPane();

    expect(
      screen.getByRole("status", { name: "Loading awards" }),
    ).toBeInTheDocument();
    const pane = await screen.findByRole("region", { name: "Selected awards" });
    expect(
      screen.queryByRole("status", { name: "Loading awards" }),
    ).not.toBeInTheDocument();
    expect(within(pane).getAllByRole("article")).toHaveLength(4);
    expect(statistics(pane)).toEqual(["4", "2013–2016", "1"]);
    expect(
      within(pane).getByRole("article", {
        name: "Graduate Management Admission Test (GMAT)",
      }),
    ).toBeInTheDocument();
    expect(
      within(pane).queryByRole("article", {
        name: "VCU School of Business Scholarship",
      }),
    ).not.toBeInTheDocument();
  },
);

test(
  "shows every honour when a visitor asks for the complete set",
  evaluatesAModuleGraph,
  async () => {
    window.history.replaceState(null, "", "/?awards-view=all");
    serveAwards(awards);

    await renderPane();

    const pane = await screen.findByRole("region", { name: "Awards & honors" });
    expect(within(pane).getAllByRole("article")).toHaveLength(7);
    expect(statistics(pane)).toEqual(["7", "2010–2019", "4"]);
    expect(
      within(pane).getByRole("article", {
        name: "VCU School of Business Scholarship",
      }),
    ).toBeInTheDocument();
  },
);

test(
  "reports a CV with no awards as a status rather than an empty grid",
  evaluatesAModuleGraph,
  async () => {
    serveAwards([]);

    await renderPane();

    // The loading frame is a status too, so wait for the settled panel's own
    // heading before asking which status the pane is left showing.
    await screen.findByRole("heading", { name: "No awards yet" });
    const panel = screen.getByRole("status");
    expect(
      within(panel).getByText("New honors and achievements will appear here."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  },
);

test(
  "reports an unavailable awards domain as an alert",
  evaluatesAModuleGraph,
  async () => {
    serveAwards({ error: "awards unavailable" }, 503);

    await renderPane();

    const panel = await screen.findByRole("alert");
    expect(
      within(panel).getByRole("heading", { name: "Awards unavailable" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  },
);

test(
  "prerenders the loading frame the built fragment ships",
  evaluatesAModuleGraph,
  async () => {
    const { default: AwardsPage } = await import("./page");
    vi.stubGlobal("window", undefined);

    const { prelude } = await prerender(<AwardsPage />);
    const html = await new Response(prelude).text();

    vi.unstubAllGlobals();
    // The build writes this markup straight into the published fragment, so parse
    // it the way a browser does before asking what a visitor finds in it.
    document.body.innerHTML = html;
    expect(
      screen.getByRole("status", { name: "Loading awards" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  },
);

test(
  "hands hosts the pane's warm-up through its page module",
  evaluatesAModuleGraph,
  async () => {
    const warmed: string[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      warmed.push(new URL(String(input)).pathname);
      return new Response(JSON.stringify(awards), {
        headers: { "content-type": "application/json" },
      });
    });
    const { preload } = await import("./page");

    await preload();

    expect(warmed).toEqual([
      "/nick-derobertis-site/cv-data/domains/awards.json",
    ]);
    await renderPane();
    // A warmed pane must mount straight onto its awards: the skeleton frame is
    // exactly what the host paid the preload to avoid showing.
    expect(
      screen.getByRole("region", { name: "Selected awards" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("status", { name: "Loading awards" }),
    ).not.toBeInTheDocument();
    expect(warmed).toHaveLength(1);
  },
);
