import type { Timeline } from "@site/data-access-core";
import { TimelineFilters } from "./timeline-filters";
import { TimelineRow } from "./timeline-row";
import { useTimelineModel } from "./use-timeline-model";

/**
 * The filtered chart. Turning both filters off is a state a visitor can reach
 * in two clicks, so it is reported as a status rather than left as an empty
 * frame they cannot tell from a failure.
 */
export function TimelineChart({ entries }: { entries: Timeline }) {
  const {
    education,
    employment,
    finalYear,
    groups,
    setEducation,
    setEmployment,
    years,
  } = useTimelineModel(entries);
  return (
    <section className="timeline-card" aria-label="Timeline visualization">
      <TimelineFilters
        education={education}
        employment={employment}
        onEducationChange={setEducation}
        onEmploymentChange={setEmployment}
      />
      {groups.length === 0 ? (
        <p className="timeline-empty" role="status">
          No timeline entries match the selected filters.
        </p>
      ) : (
        <section
          className="timeline-chart"
          aria-label="Education and employment by year"
        >
          {groups.map(([name, group]) => (
            <TimelineRow entries={group} finalYear={finalYear} key={name} />
          ))}
          <div className="timeline-axis" aria-hidden="true">
            {years.map((year) => (
              <span key={year}>{year}</span>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
