import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { previewState } from "./preview-state";

beforeEach(() => {
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("shows the settled pane to a visitor who arrives without a steer", () => {
  expect(previewState()).toBe("ready");
});

test("honours every state a visitor can steer the pane into", () => {
  for (const state of ["empty", "error", "loading"] as const) {
    window.history.replaceState(null, "", `/?skills-state=${state}`);

    expect(previewState()).toBe(state);
  }
});

test("ignores a steer the pane has no state for", () => {
  window.history.replaceState(null, "", "/?skills-state=not-a-skills-state");

  expect(previewState()).toBe("ready");
});

test("renders the settled pane for a prerender that has no location to read", () => {
  // The published fragment is built without a browser, so the query a visitor
  // will eventually arrive with cannot reach it.
  window.history.replaceState(null, "", "/?skills-state=error");
  vi.stubGlobal("window", undefined);

  expect(previewState()).toBe("ready");
});
