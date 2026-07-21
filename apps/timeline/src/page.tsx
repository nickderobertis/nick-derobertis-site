import { cvDataClient, type Timeline } from "@site/data-access-core";
import {
  groupTimelineEntries,
  type TimelineEntry,
  timelineFinalYear,
  timelineLabel,
  timelineOrganization,
  timelinePosition,
} from "@site/data-access-timeline";
import { type CSSProperties, useId, useMemo, useState } from "react";
import "./timeline.css";

type TimelineState = "empty" | "error" | "loading" | "ready";
const TIMELINE_STATES: ReadonlySet<string> = new Set([
  "empty",
  "error",
  "loading",
  "ready",
]);
const ENTRY_COLORS: Readonly<Record<string, string>> = {
  carbon_health_senior: "#ac7410",
  carbon_health_staff: "#bba5ed",
  claimfound_cto: "#8b1010",
  cnc_managing_partner: "#ef3e66",
  covariance_pm_eng: "#28344a",
  evb_portfolio_analyst: "#163c8a",
  frb_intern: "#ffb7e3",
  parliament_tutor: "#c055a9",
  spendoso_cto: "#7f110c",
  uf_ga: "#dd3434",
  "uf-ph-d-in-business-administration-finance-and-real-estate": "#b13a45",
  "vcu-bachelor-of-science-in-business-concentration-in-finance": "#a94fc8",
  "vcu-master-of-science-in-business-concentration-in-finance": "#a90026",
  vcu_ga: "#dd3434",
};

function parseTimelineState(input: unknown): TimelineState {
  return typeof input === "string" && TIMELINE_STATES.has(input)
    ? (input as TimelineState)
    : "ready";
}

function previewState(): TimelineState {
  if (typeof window === "undefined") return "ready";
  return parseTimelineState(
    new URLSearchParams(window.location.search).get("timeline-state"),
  );
}
function useTimelineModel(entries: Timeline) {
  const employmentId = useId();
  const educationId = useId();
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
    educationId,
    employment,
    employmentId,
    finalYear,
    groups,
    setEducation,
    setEmployment,
    years,
  };
}

export function TimelineChart({ entries }: { entries: Timeline }) {
  const {
    education,
    educationId,
    employment,
    employmentId,
    finalYear,
    groups,
    setEducation,
    setEmployment,
    years,
  } = useTimelineModel(entries);
  return (
    <section className="timeline-card" aria-label="Timeline visualization">
      <fieldset className="timeline-filters">
        <legend>Filters:</legend>
        <label htmlFor={employmentId}>
          <input
            id={employmentId}
            type="checkbox"
            checked={employment}
            onChange={(event) => setEmployment(event.currentTarget.checked)}
          />
          Employment
        </label>
        <label htmlFor={educationId}>
          <input
            id={educationId}
            type="checkbox"
            checked={education}
            onChange={(event) => setEducation(event.currentTarget.checked)}
          />
          Education
        </label>
      </fieldset>
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
            <div className="timeline-row" key={name}>
              <span className="timeline-organization">
                <span className="timeline-wide">
                  {timelineOrganization(group[0] as TimelineEntry)}
                </span>
                <span className="timeline-compact">
                  {timelineOrganization(group[0] as TimelineEntry, true)}
                </span>
              </span>
              <div className="timeline-periods">
                {group.map((entry) => {
                  const start = timelinePosition(entry.start, finalYear);
                  const end = entry.end
                    ? timelinePosition(entry.end, finalYear)
                    : 100;
                  return (
                    <article
                      className="timeline-period"
                      key={entry.id}
                      style={
                        {
                          "--period-color": ENTRY_COLORS[entry.id],
                          left: `${start}%`,
                          width: `${Math.max(2, end - start)}%`,
                        } as CSSProperties
                      }
                      aria-label={`${timelineLabel(entry)} at ${entry.organization}, ${entry.start} to ${entry.end ?? "present"}`}
                    >
                      <span className="timeline-wide">
                        {timelineLabel(entry)}
                      </span>
                      <span className="timeline-compact">
                        {timelineLabel(entry, true)}
                      </span>
                    </article>
                  );
                })}
              </div>
            </div>
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

export default function TimelinePage() {
  const state = previewState();
  if (state === "loading")
    return <output className="timeline-state">Loading timeline…</output>;
  if (state === "error")
    return (
      <section className="timeline-state" role="alert">
        <h2>Timeline unavailable</h2>
        <p>Timeline data could not be loaded. Please try again later.</p>
      </section>
    );
  const entries = state === "empty" ? [] : cvDataClient.domain("timeline");
  return (
    <section className="timeline-pane" aria-labelledby="timeline-heading">
      <header>
        <h2 id="timeline-heading">Educated and Experienced</h2>
        <p>Explore positions in the timeline to learn more.</p>
      </header>
      {entries.length === 0 ? (
        <p className="timeline-state" role="status">
          No education or employment entries are available.
        </p>
      ) : (
        <TimelineChart entries={entries} />
      )}
    </section>
  );
}
