export type ResearchStateName = "empty" | "error";

const messages: Record<ResearchStateName, { heading: string; detail: string }> =
  {
    empty: {
      heading: "No research projects yet",
      detail: "New research will appear here.",
    },
    error: {
      heading: "Research is unavailable",
      detail:
        "The research collection could not be loaded. Please try again later.",
    },
  };

/**
 * What the route shows instead of the project sections. Both outcomes replace
 * content the visitor is already waiting on, so the panel announces itself
 * politely rather than interrupting whatever they are reading elsewhere.
 */
export function ResearchState({ state }: { state: ResearchStateName }) {
  const { heading, detail } = messages[state];
  return (
    <section className="research-state" aria-live="polite">
      <h2>{heading}</h2>
      <p>{detail}</p>
    </section>
  );
}
