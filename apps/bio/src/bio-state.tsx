export type BioStateName = "empty" | "error";

const copy: Record<BioStateName, { heading: string; detail: string }> = {
  empty: {
    heading: "Biography coming soon",
    detail: "There is no biography to show yet.",
  },
  error: {
    heading: "Biography unavailable",
    detail: "The biography could not be displayed.",
  },
};

/**
 * What the route shows instead of the story. A failed render is announced as an
 * alert because it interrupts what the visitor came for; a biography that is
 * not written yet is only a status, because nothing went wrong.
 */
export function BioState({ state }: { state: BioStateName }) {
  const { heading, detail } = copy[state];
  return (
    <section
      className="bio-state"
      role={state === "error" ? "alert" : "status"}
    >
      <h1>{heading}</h1>
      <p>{detail}</p>
    </section>
  );
}
