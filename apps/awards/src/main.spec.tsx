import { cvDataClient } from "@site/data-access-core";
import { act, screen } from "@testing-library/react";
import { prerender } from "react-dom/static";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import AwardsPage from "./page";

const awards = cvDataClient.domain("awards");

/**
 * The markup the remote's build publishes into its own index.html. Producing it
 * from the page itself is what makes the hydration below the real one: a
 * hand-written stand-in would prove nothing about the bytes a visitor receives.
 */
async function publishedFragment() {
  const { prelude } = await prerender(<AwardsPage />);
  return await new Response(prelude).text();
}

async function startRemote() {
  vi.stubGlobal(
    "fetch",
    async () =>
      new Response(JSON.stringify(awards), {
        headers: { "content-type": "application/json" },
      }),
  );
  await act(async () => {
    await import("./main");
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

test("refuses to start against a document with no remote root", async () => {
  document.body.innerHTML = "<main></main>";

  await expect(import("./main")).rejects.toThrow("Missing remote root");
});

test("hydrates the published fragment into the awards a visitor came for", async () => {
  document.body.innerHTML = `<div id="root">${await publishedFragment()}</div>`;
  expect(
    screen.getByRole("status", { name: "Loading awards" }),
  ).toBeInTheDocument();

  await startRemote();

  expect(
    await screen.findByRole("region", { name: "Selected awards" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("status", { name: "Loading awards" }),
  ).not.toBeInTheDocument();
});

test("renders from scratch when the document ships no prerendered awards", async () => {
  document.body.innerHTML = '<div id="root"></div>';

  await startRemote();

  expect(
    await screen.findByRole("region", { name: "Selected awards" }),
  ).toBeInTheDocument();
});

test("re-renders rather than hydrating for a visitor who asked for the full set", async () => {
  // The published fragment can only ever show the selected view, so a visitor
  // arriving with a query has to be given a fresh render of what they asked for.
  window.history.replaceState(null, "", "/?awards-view=all");
  document.body.innerHTML = `<div id="root">${await publishedFragment()}</div>`;

  await startRemote();

  expect(
    await screen.findByRole("region", { name: "Awards & honors" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("region", { name: "Selected awards" }),
  ).not.toBeInTheDocument();
});
