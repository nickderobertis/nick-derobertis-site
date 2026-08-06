type CardsStateName = "error" | "empty";

const copy: Record<CardsStateName, string> = {
  error: "Areas of work could not be loaded.",
  empty: "No areas of work are available yet.",
};

/**
 * What the pane shows instead of its cards. Both messages are statuses rather
 * than alerts: a visitor asked for the home page, not for this pane, so neither
 * an empty CV nor an unreachable one interrupts what they came for.
 */
export function CardsState({ name }: { name: CardsStateName }) {
  return <output className="pane-state">{copy[name]}</output>;
}
