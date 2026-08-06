/**
 * A mark for a research category. The CV names no drawing for a category, so
 * the id picks one of four deterministically: the same category always carries
 * the same mark, wherever it appears. It is decoration beside the category's
 * own name, so it stays out of the accessibility tree.
 */
export function CategoryIcon({ id }: { id: string }) {
  const variant = id.length % 4;
  return (
    <svg className="category-icon" viewBox="0 0 32 32" aria-hidden="true">
      {variant === 0 && (
        <>
          <circle cx="16" cy="16" r="10" />
          <path d="m10 18 4-4 3 3 5-6" />
        </>
      )}
      {variant === 1 && (
        <>
          <path d="M6 24h20M9 21V11m7 10V6m7 15v-7" />
          <circle cx="9" cy="8" r="2" />
        </>
      )}
      {variant === 2 && (
        <>
          <path d="m16 4 11 20H5L16 4Z" />
          <path d="M16 11v7m0 3v1" />
        </>
      )}
      {variant === 3 && (
        <>
          <circle cx="16" cy="16" r="11" />
          <path d="M11 12h7a4 4 0 0 1 0 8h-7m5-12v16" />
        </>
      )}
    </svg>
  );
}
