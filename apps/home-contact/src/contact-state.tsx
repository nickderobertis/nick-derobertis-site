// eslint-disable-next-line @nx/enforce-module-boundaries -- The app deliberately initializes this shared library asynchronously at startup; this primitive still must be a static component dependency.
import { PaneState } from "@site/design-system";

type ContactStateName = "error" | "empty";

const copy: Record<ContactStateName, string> = {
  error: "Contact options could not be loaded.",
  empty: "No contact options are available.",
};

/**
 * What the pane shows instead of the contact channels. Both messages are
 * statuses rather than alerts: a visitor asked for the home page, not for this
 * pane, so neither a missing channel list nor an unreachable one interrupts
 * what they came for.
 */
export function ContactState({ name }: { name: ContactStateName }) {
  return <PaneState>{copy[name]}</PaneState>;
}
