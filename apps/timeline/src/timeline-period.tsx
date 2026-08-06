import type { TimelineEntry } from "@site/data-access-timeline";
import { timelineLabel, timelinePosition } from "@site/data-access-timeline";
import type { CSSProperties } from "react";
import { ENTRY_COLORS } from "./entry-colors";

/**
 * An inline style that also carries the custom properties the stylesheet reads.
 * React's own style type covers only the standard properties, so the custom
 * ones are declared here rather than smuggled past it; leaving one undefined
 * writes nothing, which is how an uncoloured entry keeps the CSS default.
 */
type PeriodStyle = CSSProperties & Record<`--${string}`, string | undefined>;

/**
 * One spell on the chart, placed and sized by its dates. Its accessible name
 * carries the whole record — role, organisation, and both dates — because the
 * bar itself only has room for a label, and a spell still running is read as
 * running to the present rather than as having no end.
 */
export function TimelinePeriod({
  entry,
  finalYear,
}: {
  entry: TimelineEntry;
  finalYear: number;
}) {
  const start = timelinePosition(entry.start, finalYear);
  const end = entry.end ? timelinePosition(entry.end, finalYear) : 100;
  const style: PeriodStyle = {
    "--period-color": ENTRY_COLORS[entry.id],
    left: `${start}%`,
    // A spell shorter than the axis can resolve would otherwise be drawn as a
    // bar with no width at all.
    width: `${Math.max(2, end - start)}%`,
  };
  return (
    <article
      className="timeline-period"
      style={style}
      aria-label={`${timelineLabel(entry)} at ${entry.organization}, ${entry.start} to ${entry.end ?? "present"}`}
    >
      <span className="timeline-wide">{timelineLabel(entry)}</span>
      <span className="timeline-compact">{timelineLabel(entry, true)}</span>
    </article>
  );
}
