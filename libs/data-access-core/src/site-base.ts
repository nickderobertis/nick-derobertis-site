import { pagesBasePattern } from "./pages-base-pattern.ts";

/**
 * The site config's Pages base, refused unless it is a string matching
 * `pagesBasePattern` (one lowercase path segment, such as `/site`), so a
 * malformed config fails loudly instead of sending every request somewhere
 * else. It carries no zod, so a remote that needs only the base keeps a schema
 * library out of its eager entry. The string check comes first because
 * `RegExp.test` would coerce a non-string JSON value.
 */
export function readPagesBase(config: { pagesBase: unknown }): string {
  const { pagesBase } = config;
  if (typeof pagesBase === "string" && pagesBasePattern.test(pagesBase))
    return pagesBase;
  throw Error("site.config.json pagesBase must be one lowercase path segment");
}
