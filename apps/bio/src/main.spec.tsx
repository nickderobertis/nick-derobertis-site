import { act, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

/**
 * Starts the remote the way its own index.html does: the entry reads the view
 * from the address bar and mounts the page itself, so nothing below the
 * document is stood in for here.
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

test("mounts the biography a visitor arriving at the remote came for", async () => {
  await startRemote();

  expect(
    await screen.findByRole("heading", { level: 1, name: "Optimizing Life" }),
  ).toBeInTheDocument();
});

test("shows the empty state to a visitor who steers the remote into it", async () => {
  await startRemote("?bio-view=empty");

  expect(
    await screen.findByRole("heading", { name: "Biography coming soon" }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("article")).not.toBeInTheDocument();
});

test("shows the error state to a visitor who steers the remote into it", async () => {
  await startRemote("?bio-view=error");

  expect(
    await screen.findByRole("heading", { name: "Biography unavailable" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("alert")).toBeInTheDocument();
});

test("ignores a view the route does not offer", async () => {
  await startRemote("?bio-view=whatever");

  expect(
    await screen.findByRole("heading", { level: 1, name: "Optimizing Life" }),
  ).toBeInTheDocument();
});
