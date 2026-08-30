import { cvDataClient } from "@site/data-access-core/bundled";
import { prerenderRouteAttribute } from "@site/route-state";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const paneNames = [
  "home-carousel",
  "home-cards",
  "home-story",
  "skills",
  "awards",
  "home-contact",
  "timeline",
];
let awardsRequests = 0;

/**
 * Stands in for the Pages host that serves the CV domains, which is the only
 * boundary the warmed pane has. Requests are counted because "one fetch per
 * warm-up" is what a host pays the preload for.
 */
function serveAwards() {
  vi.stubGlobal("fetch", async () => {
    awardsRequests += 1;
    return new Response(JSON.stringify(cvDataClient.domain("awards")), {
      headers: { "content-type": "application/json" },
    });
  });
}

/**
 * Stamps the document the shell prerenders for the Home route, which is what
 * tells the composed page it may mount its panes straight from source.
 */
function prerenderedAtHome() {
  document.body.innerHTML = `<div id="root" ${prerenderRouteAttribute}="/"></div>`;
}

async function renderComposedPage() {
  const { default: HomePage } = await import("./page");
  return render(<HomePage />);
}

beforeEach(() => {
  awardsRequests = 0;
  vi.resetModules();
  document.body.innerHTML = "";
  window.history.replaceState(null, "", "/");
  serveAwards();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("names every pane the composed page lays out, each with a fallback", async () => {
  const { homePanes } = await import("./panes");

  expect(homePanes.map(({ name }) => name)).toEqual(paneNames);
  for (const { name, Skeleton, Page } of homePanes) {
    expect(Skeleton, name).toBeTypeOf("function");
    expect(Page, name).toBeTypeOf("object");
  }
});

test("has nothing resolved until a visitor's entry route says otherwise", async () => {
  const { resolvedPanes } = await import("./panes");

  expect(resolvedPanes()).toBeUndefined();
});

test("mounts a visitor who entered at the home route straight onto its panes", async () => {
  prerenderedAtHome();

  await renderComposedPage();

  // The prerendered document already shows these panes, so suspending on them
  // again would blank the page the visitor is looking at.
  expect(
    screen.getByRole("region", { name: "Featured work" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("region", { name: "Educated and Experienced" }),
  ).toBeInTheDocument();
  // Awards is the one pane whose data is fetched, and the entry path
  // deliberately leaves it to mount on its own skeleton so hydration matches.
  expect(
    screen.getByRole("status", { name: "Loading awards" }),
  ).toBeInTheDocument();
});

test("suspends for a visitor who entered at another route", async () => {
  document.body.innerHTML = `<div id="root" ${prerenderRouteAttribute}="/bio"></div>`;

  const { resolvedPanes } = await import("./panes");

  expect(resolvedPanes()).toBeUndefined();
});

test("suspends for a visitor previewing a pane state at the home route", async () => {
  // The prerendered markup was published for the default view, so a visitor
  // who asked for another one must not be shown it from source.
  prerenderedAtHome();
  window.history.replaceState(null, "", "/?state=empty");

  const { resolvedPanes } = await import("./panes");

  expect(resolvedPanes()).toBeUndefined();
});

test("warms the panes and the awards data a host is about to show", async () => {
  const { preload, resolvedPanes } = await import("./panes");

  await preload();

  expect(resolvedPanes()?.map(({ name }) => name)).toEqual(paneNames);
  expect(awardsRequests).toBe(1);
});

test("warms once however many times a host asks", async () => {
  const { preload } = await import("./panes");

  await Promise.all([preload(), preload()]);
  await preload();

  expect(awardsRequests).toBe(1);
});

test("has nothing to warm where there is no document to render into", async () => {
  vi.stubGlobal("document", undefined);
  const { preload, resolvedPanes } = await import("./panes");

  await expect(preload()).resolves.toBeUndefined();

  // Server rendering composes the panes directly, so a warm-up there would
  // only fetch data no render is waiting on.
  expect(resolvedPanes()).toBeUndefined();
  expect(awardsRequests).toBe(0);
});
