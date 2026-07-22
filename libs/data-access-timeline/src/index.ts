import type { Timeline } from "@site/data-access-core";

export type TimelineEntry = Timeline[number];

export function groupTimelineEntries(entries: Timeline) {
  const groups = new Map<string, TimelineEntry[]>();
  for (const entry of entries)
    groups.set(entry.organization, [
      ...(groups.get(entry.organization) ?? []),
      entry,
    ]);
  return [...groups.entries()];
}

export function timelineFinalYear(entries: Timeline, currentYear: number) {
  return Math.max(
    currentYear,
    ...entries.map((entry) =>
      new Date(`${entry.end ?? entry.start}T00:00:00Z`).getUTCFullYear(),
    ),
  );
}

export function timelinePosition(date: string, finalYear: number) {
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

export function timelineLabel(entry: TimelineEntry, short = false) {
  return "degree" in entry
    ? short
      ? (entry.short_degree ?? entry.degree)
      : entry.degree
    : short
      ? (entry.title_short ?? entry.title)
      : entry.title;
}

export function timelineOrganization(entry: TimelineEntry, short = false) {
  if (!short) return entry.organization;
  if ("title" in entry) return entry.organization_short ?? entry.organization;
  return entry.organization === "University of Florida"
    ? "UF"
    : entry.organization === "Virginia Commonwealth University"
      ? "VCU"
      : entry.organization;
}
