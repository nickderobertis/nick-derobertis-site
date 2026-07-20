import { cvDataClient, type Timeline } from "@site/data-access";
import { type CSSProperties, useId, useMemo, useState } from "react";
import "./timeline.css";

type Entry = Timeline[number];
const COLORS = [
  ["#28344a", "#ac7410"],
  ["#bba5ed", "#7f110c"],
  ["#c055a9", "#8b1010"],
  ["#b13a45", "#dd3434"],
  ["#a94fc8", "#a90026"],
  ["#ef3e66", "#163c8a"],
] as const;

function previewState() {
  if (typeof window === "undefined") return "ready";
  return new URLSearchParams(window.location.search).get("timeline-state");
}
function position(date: string, finalYear: number) {
  const value = new Date(`${date}T00:00:00Z`);
  return Math.max(
    0,
    Math.min(
      100,
      ((value.getUTCFullYear() - 2011 + value.getUTCMonth() / 12) /
        (finalYear + 1 - 2011)) *
        100,
    ),
  );
}
function label(entry: Entry, short = false) {
  return "degree" in entry
    ? short
      ? (entry.short_degree ?? entry.degree)
      : entry.degree
    : short
      ? (entry.title_short ?? entry.title)
      : entry.title;
}
function organization(entry: Entry, short = false) {
  if (!short) return entry.organization;
  if ("title" in entry) return entry.organization_short ?? entry.organization;
  return entry.organization === "University of Florida"
    ? "UF"
    : entry.organization === "Virginia Commonwealth University"
      ? "VCU"
      : entry.organization;
}

export function TimelineChart({ entries }: { entries: Timeline }) {
  const employmentId = useId();
  const educationId = useId();
  const [employment, setEmployment] = useState(true);
  const [education, setEducation] = useState(true);
  const filtered = entries.filter((entry) =>
    entry.kind === "education" ? education : employment,
  );
  const groups = useMemo(() => {
    const result = new Map<string, Entry[]>();
    for (const entry of filtered)
      result.set(entry.organization, [
        ...(result.get(entry.organization) ?? []),
        entry,
      ]);
    return [...result.entries()];
  }, [filtered]);
  const finalYear = Math.max(
    new Date().getUTCFullYear(),
    ...entries.map((entry) =>
      new Date(`${entry.end ?? entry.start}T00:00:00Z`).getUTCFullYear(),
    ),
  );
  const years: number[] = [];
  for (let year = 2011; year <= finalYear; year += 1) years.push(year);
  return (
    <div className="timeline-card">
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
          {groups.map(([name, group], groupIndex) => (
            <div className="timeline-row" key={name}>
              <span className="timeline-organization">
                <span className="timeline-wide">
                  {organization(group[0] as Entry)}
                </span>
                <span className="timeline-compact">
                  {organization(group[0] as Entry, true)}
                </span>
              </span>
              <div className="timeline-periods">
                {group.map((entry, entryIndex) => {
                  const start = position(entry.start, finalYear);
                  const end = entry.end ? position(entry.end, finalYear) : 100;
                  return (
                    <article
                      className="timeline-period"
                      key={entry.id}
                      style={
                        {
                          "--period-color":
                            COLORS[groupIndex % COLORS.length]?.[
                              entryIndex % 2
                            ],
                          left: `${start}%`,
                          width: `${Math.max(2, end - start)}%`,
                        } as CSSProperties
                      }
                      aria-label={`${label(entry)} at ${entry.organization}, ${entry.start} to ${entry.end ?? "present"}`}
                    >
                      <span className="timeline-wide">{label(entry)}</span>
                      <span className="timeline-compact">
                        {label(entry, true)}
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
    </div>
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
