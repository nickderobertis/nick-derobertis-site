import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { useBioView } from "./use-bio-view";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

test("shows the story when no view was asked for", () => {
  const { result } = renderHook(() => useBioView());

  expect(result.current).toBe("default");
});

test("keeps a settled preview state for as long as a visitor stays on it", () => {
  const { result } = renderHook(() => useBioView("error"));

  expect(result.current).toBe("error");
  act(() => {
    vi.advanceTimersByTime(10_000);
  });
  expect(result.current).toBe("error");
});

test("demonstrates the loading preview and then hands the story back", () => {
  const { result } = renderHook(() => useBioView("loading"));

  expect(result.current).toBe("loading");
  act(() => {
    vi.advanceTimersByTime(1_499);
  });
  expect(result.current).toBe("loading");
  act(() => {
    vi.advanceTimersByTime(1);
  });
  expect(result.current).toBe("default");
});

test("drops its pending preview timer when the visitor leaves the route", () => {
  const { result, unmount } = renderHook(() => useBioView("loading"));

  expect(result.current).toBe("loading");
  expect(vi.getTimerCount()).toBe(1);

  unmount();

  // A timer left running past the route would resolve a preview onto a pane the
  // visitor has already navigated away from, so leaving has to cancel it.
  expect(vi.getTimerCount()).toBe(0);
});
