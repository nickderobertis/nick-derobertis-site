import type { TimelineEntry } from "@site/data-access-timeline";
import { timelineOrganization } from "@site/data-access-timeline";
import { TimelinePeriod } from "./timeline-period";

/**
 * One organisation's row, carrying every spell served there. The name is
 * written twice — in full and abbreviated — so the phone layout can swap to the
 * short form in CSS without the row losing what it says.
 */
export function TimelineRow({
  entries,
  finalYear,
}: {
  entries: readonly TimelineEntry[];
  finalYear: number;
}) {
  // The grouping this row is built from only ever emits organisations it found
  // at least one entry under, so the row always has a record to name itself by.
  const first = entries[0] as TimelineEntry;
  return (
    <div className="timeline-row">
      <span className="timeline-organization">
        <span className="timeline-wide">{timelineOrganization(first)}</span>
        <span className="timeline-compact">
          {timelineOrganization(first, true)}
        </span>
      </span>
      <div className="timeline-periods">
        {entries.map((entry) => (
          <TimelinePeriod entry={entry} finalYear={finalYear} key={entry.id} />
        ))}
      </div>
    </div>
  );
}
