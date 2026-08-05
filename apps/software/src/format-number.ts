/**
 * Groups a count for reading. The locale is fixed rather than taken from the
 * browser so a card and the totals above it never disagree about where the
 * separators go, and so the prerendered fragment matches what hydration renders.
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}
