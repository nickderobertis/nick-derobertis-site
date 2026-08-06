/**
 * What the pane shows instead of the tree. A failed load is announced as an
 * alert because it interrupts what the visitor came for; a CV that lists no
 * skills is only a status, because nothing went wrong.
 */
export function SkillsState({ name }: { name: "empty" | "error" }) {
  if (name === "empty")
    return (
      <p className="skills-state" role="status">
        No skills are available.
      </p>
    );
  return (
    <section className="skills-state" role="alert">
      <h2>Skills unavailable</h2>
      <p>Skills data could not be loaded. Please try again later.</p>
    </section>
  );
}
