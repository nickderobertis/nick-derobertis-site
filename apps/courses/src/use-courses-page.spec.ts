import { courses } from "@site/data-access-courses";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { useCoursesPage } from "./use-courses-page";

const published = courses;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

test("hands back the courses the CV publishes when the route asks for nothing", () => {
  const { result } = renderHook(() => useCoursesPage());

  expect(result.current.view).toBe("default");
  expect(result.current.courses).toEqual(published);
  expect(result.current.courses.map((course) => course.id)).toEqual([
    "FIN-4934",
    "FIN-4243",
    "FIRE-311",
  ]);
});

test("prefers the courses a host already resolved over its own read", () => {
  const hostCourses = published.slice(0, 1);

  const { result } = renderHook(() => useCoursesPage(undefined, hostCourses));

  expect(result.current.courses).toEqual(hostCourses);
});

test("shows an empty catalogue when the host resolved one", () => {
  const { result } = renderHook(() => useCoursesPage("empty", []));

  expect(result.current).toEqual({ courses: [], view: "empty" });
});

test("keeps a settled preview state for as long as a visitor stays on it", () => {
  const { result } = renderHook(() => useCoursesPage("error"));

  act(() => {
    vi.advanceTimersByTime(10_000);
  });
  expect(result.current.view).toBe("error");
});

test("demonstrates the loading preview and then hands the courses back", () => {
  const { result } = renderHook(() => useCoursesPage("loading"));

  expect(result.current.view).toBe("loading");
  act(() => {
    vi.advanceTimersByTime(1_499);
  });
  expect(result.current.view).toBe("loading");
  act(() => {
    vi.advanceTimersByTime(1);
  });
  expect(result.current.view).toBe("default");
  expect(result.current.courses).toEqual(published);
});

test("drops its pending preview timer when the visitor leaves the route", () => {
  const { unmount } = renderHook(() => useCoursesPage("loading"));

  expect(vi.getTimerCount()).toBe(1);

  unmount();

  // A timer left running past the route would resolve a preview onto a pane the
  // visitor has already navigated away from, so leaving has to cancel it.
  expect(vi.getTimerCount()).toBe(0);
});
