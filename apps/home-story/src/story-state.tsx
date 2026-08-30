import { PaneState } from "@site/design-system";

type StoryStateName = "error" | "empty";

const copy: Record<StoryStateName, string> = {
  error: "Nick’s story could not be loaded.",
  empty: "No story is available yet.",
};

/**
 * What the pane shows instead of the story. Both messages are statuses rather
 * than alerts: a visitor asked for the home page, not for this pane, so neither
 * an unwritten story nor an unreachable one interrupts what they came for.
 */
export function StoryState({ name }: { name: StoryStateName }) {
  return <PaneState>{copy[name]}</PaneState>;
}
