import { act, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

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
  });
}

beforeEach(() => {
  vi.resetModules();
  document.body.innerHTML = "";
  window.history.replaceState(null, "", "/");
});

test("refuses to start against a document with no remote root", async () => {
  document.body.innerHTML = "<main></main>";

  await expect(import("./main")).rejects.toThrow("Missing remote root");
});

test("mounts the portfolio a visitor arriving at the remote came for", async () => {
  await startRemote();

  expect(
    await screen.findByRole("heading", { level: 1, name: "Research Works" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("region", { name: "Working Papers" }),
  ).toBeInTheDocument();
});

test("shows the empty collection to a visitor who steers the remote into it", async () => {
  await startRemote("?research-scenario=empty");

  expect(
    await screen.findByRole("heading", { name: "No research projects yet" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("region", { name: "Working Papers" }),
  ).not.toBeInTheDocument();
});

test("shows the failed collection to a visitor who steers the remote into it", async () => {
  await startRemote("?research-scenario=error");

  expect(
    await screen.findByRole("heading", { name: "Research is unavailable" }),
  ).toBeInTheDocument();
});

test("holds the loading frame a visitor asks the remote to demonstrate", async () => {
  await startRemote("?research-scenario=loading");

  expect(
    await screen.findByRole("status", { name: "Loading research" }),
  ).toBeInTheDocument();
});

test("ignores a scenario the route does not offer", async () => {
  await startRemote("?research-scenario=whatever");

  expect(
    await screen.findByRole("heading", { level: 1, name: "Research Works" }),
  ).toBeInTheDocument();
});
