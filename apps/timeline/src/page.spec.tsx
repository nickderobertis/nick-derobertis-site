import { cvDataClient } from "@site/data-access-core";
import { render, screen } from "@testing-library/react";
import { prerender } from "react-dom/static";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

// `vi.resetModules()` makes every test below re-import its subject, evaluating
// that whole module graph again: 1.4s idle here, 12.6s under the contention
// `nx affected --parallel=3` puts the gate under, past Vitest's 5000ms default.
// Far past that rather than just past it, so it still bounds a genuine hang.
const moduleGraphCeiling = { timeout: 120_000 };

const entries = cvDataClient.domain("timeline");

async function renderPane() {
  const { default: TimelinePage } = await import("./page");
  return render(<TimelinePage />);
}

function openWith(query: string) {
  window.history.replaceState(null, "", query);
}

function chart() {
  return screen.queryByRole("region", {
    name: "Education and employment by year",
  });
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
  "renders the CV's whole history for a visitor who just arrives",
  moduleGraphCeiling,
  async () => {
    await renderPane();

    expect(
      screen.getByRole("region", { name: "Educated and Experienced" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Educated and Experienced",
      }),
    ).toBeInTheDocument();
    expect(chart()).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(entries.length);
  },
);

test(
  "holds the loading frame for a visitor steering the pane into it",
  moduleGraphCeiling,
  async () => {
    openWith("/?timeline-state=loading");

    await renderPane();

    expect(
      screen.getByRole("status", { name: "Loading timeline" }),
    ).toBeInTheDocument();
    expect(chart()).not.toBeInTheDocument();
  },
);

test(
  "keeps the pane's heading when the CV records no history",
  moduleGraphCeiling,
  async () => {
    openWith("/?timeline-state=empty");

    await renderPane();

    // The empty report sits inside the pane rather than replacing it, so a
    // visitor still knows which pane is telling them there is nothing to show.
    expect(
      screen.getByRole("region", { name: "Educated and Experienced" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "No education or employment entries are available.",
    );
    expect(chart()).not.toBeInTheDocument();
  },
);

test(
  "reports an unavailable timeline as an alert in place of the pane",
  moduleGraphCeiling,
  async () => {
    openWith("/?timeline-state=error");

    await renderPane();

    expect(screen.getByRole("alert")).toHaveTextContent("Timeline unavailable");
    expect(
      screen.queryByRole("region", { name: "Educated and Experienced" }),
    ).not.toBeInTheDocument();
  },
);

test(
  "ignores a steer it has no state for and shows the history",
  moduleGraphCeiling,
  async () => {
    openWith("/?timeline-state=not-a-timeline-state");

    await renderPane();

    expect(chart()).toBeInTheDocument();
  },
);

test(
  "prerenders the settled history the built fragment ships",
  moduleGraphCeiling,
  async () => {
    const { default: TimelinePage } = await import("./page");
    vi.stubGlobal("window", undefined);

    const { prelude } = await prerender(<TimelinePage />);
    const html = await new Response(prelude).text();

    vi.unstubAllGlobals();
    // The build writes this markup straight into the published fragment, so parse
    // it the way a browser does before asking what a visitor finds in it.
    document.body.innerHTML = html;
    expect(chart()).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(entries.length);
  },
);
