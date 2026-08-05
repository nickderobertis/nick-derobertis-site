import type { Timeline } from "@site/data-access-core";
import {
  groupTimelineEntries,
  timelineFinalYear,
} from "@site/data-access-timeline";
import { useMemo, useState } from "react";

/**
 * What the chart is currently showing. Both filters start on, so a visitor sees
 * the whole history before narrowing it; the axis runs from 2011 to whichever
 * year the CV or the calendar reaches last, so an entry that is still running
 * has somewhere to end.
 */
export function useTimelineModel(entries: Timeline) {
  const [employment, setEmployment] = useState(true);
  const [education, setEducation] = useState(true);
  const filtered = entries.filter((entry) =>
    entry.kind === "education" ? education : employment,
  );
  const groups = useMemo(() => groupTimelineEntries(filtered), [filtered]);
  const finalYear = timelineFinalYear(entries, new Date().getUTCFullYear());
  const years: number[] = [];
  for (let year = 2011; year <= finalYear; year += 1) years.push(year);
  return {
    education,
    employment,
    finalYear,
    groups,
    setEducation,
    setEmployment,
    years,
  };
}
