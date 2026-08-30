import { timeline } from "@site/data-access-timeline";
import { act, renderHook } from "@testing-library/react";
import { expect, test } from "vitest";
import { useTimelineModel } from "./use-timeline-model";

const entries = timeline;

function organizations(groups: ReadonlyArray<readonly [string, unknown]>) {
  return groups.map(([organization]) => organization);
}

test("opens on the whole CV, with both halves of it showing", () => {
  const { result } = renderHook(() => useTimelineModel(entries));

  expect(result.current.education).toBe(true);
  expect(result.current.employment).toBe(true);
  expect(result.current.groups.flatMap(([, group]) => group)).toHaveLength(
    entries.length,
  );
});

test("runs the axis from 2011 to the last year the CV or the calendar reaches", () => {
  const { result } = renderHook(() => useTimelineModel(entries));

  // Roles the CV records without an end run to today, so the axis has to reach
  // at least the current year for them to have anywhere to end.
  expect(result.current.years[0]).toBe(2011);
  expect(result.current.finalYear).toBeGreaterThanOrEqual(
    new Date().getUTCFullYear(),
  );
  expect(result.current.years.at(-1)).toBe(result.current.finalYear);
});

test("drops the employment half when a visitor turns it off", () => {
  const { result } = renderHook(() => useTimelineModel(entries));

  act(() => result.current.setEmployment(false));

  const kinds = new Set(
    result.current.groups.flatMap(([, group]) =>
      group.map((entry) => entry.kind),
    ),
  );
  expect(kinds).toEqual(new Set(["education"]));
  expect(organizations(result.current.groups)).toEqual([
    "University of Florida",
    "Virginia Commonwealth University",
  ]);
});

test("keeps both kinds of employment when only education is turned off", () => {
  const { result } = renderHook(() => useTimelineModel(entries));

  act(() => result.current.setEducation(false));

  const kinds = new Set(
    result.current.groups.flatMap(([, group]) =>
      group.map((entry) => entry.kind),
    ),
  );
  expect(kinds).toEqual(
    new Set(["professional_employment", "academic_employment"]),
  );
});

test("has nothing left to group once both filters are off", () => {
  const { result } = renderHook(() => useTimelineModel(entries));

  act(() => result.current.setEmployment(false));
  act(() => result.current.setEducation(false));

  expect(result.current.groups).toEqual([]);
  // The axis is a property of the CV, not of the filters, so it survives a
  // selection that leaves no rows to hang from it.
  expect(result.current.years[0]).toBe(2011);
});
