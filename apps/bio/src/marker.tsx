/**
 * A pictograph that decorates a heading. It carries no meaning a reader of the
 * heading is missing, so it stays out of the accessibility tree rather than
 * being announced between the heading's words.
 */
export function Marker({ children }: { children: string }) {
  return <span aria-hidden="true">{children}</span>;
}
