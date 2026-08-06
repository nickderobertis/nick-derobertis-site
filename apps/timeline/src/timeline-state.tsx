/**
 * What the pane shows instead of the chart. A failed load is announced as an
 * alert because it interrupts what the visitor came for; a CV that records no
 * education or employment is only a status, because nothing went wrong.
 */
export function TimelineState({ name }: { name: "empty" | "error" }) {
  if (name === "empty")
    return (
      <p className="timeline-state" role="status">
        No education or employment entries are available.
      </p>
    );
  return (
    <section className="timeline-state" role="alert">
      <h2>Timeline unavailable</h2>
      <p>Timeline data could not be loaded. Please try again later.</p>
    </section>
  );
}
