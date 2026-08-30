import { softwareProjects } from "@site/data-access-software";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { useSoftwarePage } from "./use-software-page";

const published = softwareProjects;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

test("hands back the projects the CV publishes when the route asks for nothing", () => {
  const { result } = renderHook(() => useSoftwarePage());

  expect(result.current.view).toBe("default");
  expect(result.current.projects).toEqual(published);
  expect(result.current.projects).toHaveLength(72);
});

test("prefers the projects a host already resolved over its own read", () => {
  const hostProjects = published.slice(0, 2);

  const { result } = renderHook(() => useSoftwarePage(undefined, hostProjects));

  expect(result.current.projects).toEqual(hostProjects);
});

test("shows an empty portfolio when the host resolved one", () => {
  const { result } = renderHook(() => useSoftwarePage("empty", []));

  expect(result.current).toEqual({ projects: [], view: "empty" });
});

test("keeps a settled preview state for as long as a visitor stays on it", () => {
  const { result } = renderHook(() => useSoftwarePage("error"));

  act(() => {
    vi.advanceTimersByTime(10_000);
  });
  expect(result.current.view).toBe("error");
});

test("demonstrates the loading preview and then hands the projects back", () => {
  const { result } = renderHook(() => useSoftwarePage("loading"));

  expect(result.current.view).toBe("loading");
  act(() => {
    vi.advanceTimersByTime(1_499);
  });
  expect(result.current.view).toBe("loading");
  act(() => {
    vi.advanceTimersByTime(1);
  });
  expect(result.current.view).toBe("default");
  expect(result.current.projects).toEqual(published);
});

test("drops its pending preview timer when the visitor leaves the route", () => {
  const { unmount } = renderHook(() => useSoftwarePage("loading"));

  expect(vi.getTimerCount()).toBe(1);

  unmount();

  // A timer left running past the route would resolve a preview onto a pane the
  // visitor has already navigated away from, so leaving has to cancel it.
  expect(vi.getTimerCount()).toBe(0);
});
