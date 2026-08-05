export type TimelinePreviewState = "empty" | "error" | "loading" | "ready";

const TIMELINE_STATES: ReadonlySet<string> = new Set([
  "empty",
  "error",
  "loading",
  "ready",
]);

export function parseTimelineState(input: unknown): TimelinePreviewState {
  return typeof input === "string" && TIMELINE_STATES.has(input)
    ? (input as TimelinePreviewState)
    : "ready";
}

/**
 * The pane state a visitor steered the remote into with `?timeline-state=`. The
 * published fragment is prerendered without a location to read, so it always
 * renders the settled timeline, and an unrecognised value is ignored rather
 * than leaving the visitor on a state the pane cannot render.
 */
export function previewState(): TimelinePreviewState {
  if (typeof window === "undefined") return "ready";
  return parseTimelineState(
    new URLSearchParams(window.location.search).get("timeline-state"),
  );
}
