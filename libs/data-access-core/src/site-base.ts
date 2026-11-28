/**
 * The site config's Pages base, refused unless it is one lowercase path segment
 * such as `/site`, so a malformed config fails loudly instead of sending every
 * request somewhere else. It is the one reader of `pagesBase` and carries no
 * zod, so a remote that needs only the base keeps a schema library out of its
 * eager entry. TypeScript already types the JSON import as a string; the shape
 * is what only a runtime check can hold.
 */
export function readPagesBase(config: { pagesBase: string }): string {
  if (/^\/[a-z0-9-]+$/.test(config.pagesBase)) return config.pagesBase;
  throw Error(
    "site.config.json pagesBase must be one lowercase path segment, such as /site",
  );
}
