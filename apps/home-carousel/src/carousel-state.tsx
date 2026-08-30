import { PaneState } from "@site/design-system";

type CarouselStateName = "error" | "empty";

const copy: Record<CarouselStateName, string> = {
  error: "Featured stories could not be loaded.",
  empty: "No featured stories are available yet.",
};

/**
 * What the pane shows instead of the featured stories. Both messages are
 * statuses rather than alerts: a visitor asked for the home page, not for this
 * pane, so neither an empty rotation nor an unreachable one interrupts what
 * they came for.
 */
export function CarouselState({ name }: { name: CarouselStateName }) {
  return <PaneState>{copy[name]}</PaneState>;
}
