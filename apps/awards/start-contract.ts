import siteConfig from "@site/data-access-core/site.config.json";

const { pagesBase } = siteConfig;
if (!/^\/[a-z0-9-]+$/.test(pagesBase))
  throw new Error("site.config.json must define a valid pagesBase");

export const awardsRouterBasepath = `${pagesBase}/remotes/awards`;
export const awardsPublicPath = `${awardsRouterBasepath}/`;
