import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { parseTimelineState, previewState } from "./preview-state";

beforeEach(() => {
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("shows the settled timeline to a visitor who arrives without a steer", () => {
  expect(previewState()).toBe("ready");
});

test("honours every state a visitor can steer the pane into", () => {
  for (const state of ["empty", "error", "loading", "ready"] as const) {
    window.history.replaceState(null, "", `/?timeline-state=${state}`);

    expect(previewState()).toBe(state);
  }
});

test("ignores a steer the pane has no state for", () => {
  window.history.replaceState(null, "", "/?timeline-state=not-a-state");

  expect(previewState()).toBe("ready");
});

test("ignores an absent steer as readily as an unrecognised one", () => {
  // A URL with no `timeline-state` at all hands the parser null rather than a
  // string, which is the boundary the query reader crosses on every arrival.
  expect(parseTimelineState(null)).toBe("ready");
  expect(parseTimelineState(42)).toBe("ready");
});

test("renders the settled timeline for a prerender with no location to read", () => {
  window.history.replaceState(null, "", "/?timeline-state=error");
  vi.stubGlobal("window", undefined);

  expect(previewState()).toBe("ready");
});
