export type SkillsPreviewState = "empty" | "error" | "loading" | "ready";

/**
 * The pane state a visitor steered the remote into with `?skills-state=`. The
 * published fragment is prerendered without a location to read, so it always
 * renders the settled pane, and an unrecognised value is ignored rather than
 * leaving the visitor on a state the pane cannot render.
 */
export function previewState(): SkillsPreviewState {
  if (typeof window === "undefined") return "ready";
  const value = new URLSearchParams(window.location.search).get("skills-state");
  return value === "empty" || value === "error" || value === "loading"
    ? value
    : "ready";
}
