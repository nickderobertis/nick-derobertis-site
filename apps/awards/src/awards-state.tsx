const copy = {
  error: [
    "Awards unavailable",
    "Awards could not be loaded. Please try again later.",
  ],
  empty: ["No awards yet", "New honors and achievements will appear here."],
} as const;

/**
 * What the pane shows instead of cards. A failed request is announced as an
 * alert because it interrupts what the visitor came for; an empty CV is only a
 * status, because nothing went wrong.
 */
export function AwardsState({ name }: { name: "error" | "empty" }) {
  const [heading, detail] = copy[name];
  return (
    <section
      className="awards-state"
      role={name === "error" ? "alert" : "status"}
    >
      <h2>{heading}</h2>
      <p>{detail}</p>
    </section>
  );
}
