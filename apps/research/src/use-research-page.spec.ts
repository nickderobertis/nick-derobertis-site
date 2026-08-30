import { research } from "@site/data-access-research";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { useResearchPage } from "./use-research-page";

const published = research;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

test("hands back the research the CV publishes when the route asks for nothing", () => {
  const { result } = renderHook(() => useResearchPage());

  expect(result.current).toEqual({ name: "ready", value: published });
});

test("keeps a failed state until the visitor leaves it", () => {
  const { result } = renderHook(() => useResearchPage({ name: "error" }));

  act(() => {
    vi.advanceTimersByTime(10_000);
  });
  expect(result.current).toEqual({ name: "error" });
});

test("keeps an empty collection a host resolved rather than replacing it", () => {
  const empty = { projects: [] };

  const { result } = renderHook(() =>
    useResearchPage({ name: "ready", value: empty }),
  );

  act(() => {
    vi.advanceTimersByTime(10_000);
  });
  expect(result.current).toEqual({ name: "ready", value: empty });
});

test("demonstrates the loading preview and then hands the research back", () => {
  const { result } = renderHook(() => useResearchPage({ name: "loading" }));

  expect(result.current).toEqual({ name: "loading" });
  act(() => {
    vi.advanceTimersByTime(1_499);
  });
  expect(result.current).toEqual({ name: "loading" });
  act(() => {
    vi.advanceTimersByTime(1);
  });
  expect(result.current).toEqual({ name: "ready", value: published });
});

test("drops its pending preview timer when the visitor leaves the route", () => {
  const { unmount } = renderHook(() => useResearchPage({ name: "loading" }));

  expect(vi.getTimerCount()).toBe(1);

  unmount();

  // A timer left running past the route would resolve a preview onto a pane the
  // visitor has already navigated away from, so leaving has to cancel it.
  expect(vi.getTimerCount()).toBe(0);
});
