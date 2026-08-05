import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { useCarousel } from "./use-carousel";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

test("advances to the next story every five seconds and wraps around", () => {
  const { result } = renderHook(() => useCarousel(2, true));

  expect(result.current.active).toBe(0);
  act(() => vi.advanceTimersByTime(5000));
  expect(result.current.active).toBe(1);
  act(() => vi.advanceTimersByTime(5000));
  expect(result.current.active).toBe(0);
});

test("holds still for a pane that has no stories to rotate through", () => {
  // The empty, loading, and error panes render no carousel, so rotating them
  // would only queue state updates nothing can show.
  const { result } = renderHook(() => useCarousel(2, false));

  act(() => vi.advanceTimersByTime(60_000));

  expect(result.current.active).toBe(0);
});

test("stops rotating once the pane is gone", () => {
  const { result, unmount } = renderHook(() => useCarousel(2, true));

  unmount();
  act(() => vi.advanceTimersByTime(15_000));

  expect(result.current.active).toBe(0);
});

test("wraps in both directions so either control works at either end", () => {
  const { result } = renderHook(() => useCarousel(3, true));

  act(() => result.current.move(-1));
  expect(result.current.active).toBe(2);
  act(() => result.current.move(1));
  expect(result.current.active).toBe(0);
  act(() => result.current.move(2));
  expect(result.current.active).toBe(2);
});
