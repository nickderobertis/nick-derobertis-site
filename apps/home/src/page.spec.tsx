import { cvDataClient } from "@site/data-access-core";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

// Every landmark the composed page owes a visitor, one per pane Home declares,
// each a region named by the pane's own heading. Home is the only place these
// seven appear together, so this is what a broken composition breaks.
const paneLandmarks = [
  "Featured work",
  "Areas of work",
  "Who am I?",
  "Skilled in…",
  "Selected awards",
  "Let’s build something useful.",
  "Educated and Experienced",
];

const paneSkeletons = [
  "Loading featured work",
  "Loading areas of work",
  "Loading story",
  "Loading skills",
  "Loading awards",
  "Loading contact options",
  "Loading timeline",
];

/**
 * Stands in for the Pages host that serves the CV domains, which is the awards
 * pane's only boundary — and the only pane that fetches at all. Every other
 * pane, and Home's own composition, is the real thing.
 */
function serveAwards() {
  vi.stubGlobal(
    "fetch",
    async () =>
      new Response(JSON.stringify(cvDataClient.domain("awards")), {
        headers: { "content-type": "application/json" },
      }),
  );
}

async function renderComposedPage() {
  const { default: HomePage } = await import("./page");
  return render(<HomePage />);
}

beforeEach(() => {
  vi.resetModules();
  document.body.innerHTML = "";
  window.history.replaceState(null, "", "/");
  serveAwards();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("suspends on one skeleton per pane before any of them arrive", async () => {
  await renderComposedPage();

  for (const name of paneSkeletons)
    expect(screen.getByRole("status", { name }), name).toBeInTheDocument();
});

test("settles onto all seven panes the composition declares", async () => {
  await renderComposedPage();

  for (const name of paneLandmarks)
    expect(
      await screen.findByRole("region", { name }),
      name,
    ).toBeInTheDocument();
  for (const name of paneSkeletons)
    expect(screen.queryByRole("status", { name }), name).toBeNull();
});

test("lays the panes out in the order the composition declares", async () => {
  const { container } = await renderComposedPage();
  await screen.findByRole("region", { name: "Educated and Experienced" });

  const composed = container.querySelector(".home-main");
  expect(composed).not.toBeNull();
  // The carousel opens the page and the timeline closes it; a pane that lands
  // in the wrong slot rearranges the page a visitor scrolls through.
  expect(composed?.firstElementChild).toContainElement(
    screen.getByRole("region", { name: "Featured work" }),
  );
  expect(composed?.lastElementChild).toContainElement(
    screen.getByRole("region", { name: "Educated and Experienced" }),
  );
});

test("hands each pane the query a visitor previews a state with", async () => {
  window.history.replaceState(null, "", "/?state=empty");

  await renderComposedPage();

  // The four panes Home drives through the shared `state` query answer it; the
  // three that own their own queries keep rendering their content.
  for (const message of [
    "No featured stories are available yet.",
    "No areas of work are available yet.",
    "No story is available yet.",
    "No contact options are available.",
  ])
    expect(await screen.findByText(message), message).toBeInTheDocument();
  expect(
    await screen.findByRole("region", { name: "Educated and Experienced" }),
  ).toBeInTheDocument();
});

test("hands hosts the composed page's warm-up through its page module", async () => {
  const { preload } = await import("./page");

  await expect(preload()).resolves.toBeUndefined();

  await renderComposedPage();
  // A warmed Home mounts straight onto its panes: the skeletons are exactly
  // what the shell paid the preload to avoid showing.
  for (const name of paneLandmarks)
    expect(screen.getByRole("region", { name }), name).toBeInTheDocument();
  expect(screen.queryByRole("status")).toBeNull();
});
