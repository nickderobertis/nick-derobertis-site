/**
 * The one lowercase path segment, such as `/site`, that the site config's Pages
 * base must be. Its single source: `readPagesBase` and the zod site module both
 * import it, and it sits alone so neither drags in the other.
 */
export const pagesBasePattern = /^\/[a-z0-9-]+$/;
