import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
// The prerender CLIs load this module through Node's type stripping, where a
// workspace alias does not resolve, so the canonical remote registry is read
// as the serialized build input it is.
// eslint-disable-next-line @nx/enforce-module-boundaries -- This pure contract parser reads the canonical serialized build manifest directly because Node type stripping cannot resolve workspace aliases.
import remoteManifest from "../../build-config/src/remotes.json" with {
  type: "json",
};
import { parseRemoteManifest } from "./route-contracts.ts";

// Each remote ships its page CSS with its own federated JavaScript, so a
// prerendered route document would otherwise paint its server-rendered content
// unstyled until roughly a megabyte of JavaScript arrives. This map records
// which remotes' markup each route document prerenders; the prerender step
// inlines exactly those remotes' page CSS, and the artifact check verifies it.
// Home is itself a host, so its document owns the seven panes it composes too.
const routeRemotes: Record<string, readonly string[]> = {
  "/": [
    "home",
    "home-carousel",
    "home-cards",
    "home-story",
    "home-contact",
    "timeline",
    "skills",
    "awards",
  ],
  "/bio": ["bio"],
  "/research": ["research"],
  "/software": ["software"],
  "/courses": ["courses"],
};

const validatedRemoteManifest = parseRemoteManifest(remoteManifest);
for (const [routePath, names] of Object.entries(routeRemotes)) {
  const unknown = names.filter((name) => !(name in validatedRemoteManifest));
  /* v8 ignore next 4 -- This cross-check runs at import over the committed map and registry, so its rejection branch is reachable only from a tree that already fails just check; the named diagnostic is what makes that failure readable. */
  if (unknown.length > 0)
    throw new Error(
      `The prerender CSS map lists remotes for ${routePath} that are absent from remotes.json: ${unknown.join(", ")}. Align libs/artifact-contracts/src/remote-css.ts with libs/build-config/src/remotes.json and rerun just check.`,
    );
}

export const inlineRemoteCssAttribute = "data-prerender-remote-css";

// Matches only the style elements this module emits, so normalizing a cached
// prerender output never removes markup the bundler produced. The payload can
// never contain `</style`, which readRemoteCss rejects, so the lazy match is
// bounded by the element it opened.
export const inlineRemoteCssPattern = new RegExp(
  `<style ${inlineRemoteCssAttribute}="[^"]*">[\\s\\S]*?</style>`,
  "g",
);

export function remotesForRoute(routePath: string): readonly string[] {
  const names = Object.hasOwn(routeRemotes, routePath)
    ? routeRemotes[routePath]
    : undefined;
  if (!names)
    throw new Error(
      `No prerendered page CSS is declared for route ${JSON.stringify(routePath)}. Add its remotes to routeRemotes in libs/artifact-contracts/src/remote-css.ts and rerun just check.`,
    );
  return names;
}

export function validatePagesBase(value: unknown): string {
  if (typeof value !== "string" || !/^\/[a-z0-9-]+$/.test(value))
    throw new Error(
      `The Pages base path must match /[a-z0-9-]+; received ${JSON.stringify(value)}. Fix libs/data-access-core/src/site.config.json and rerun just check.`,
    );
  return value;
}

const stylesheetLinkPattern = /<link\b[^>]*>/g;
const hrefPattern = /\shref="([^"]*)"/;
const mainStylesheetPattern = /^main\.[0-9a-f]+\.css$/;
const cssUrlPattern = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)'"\s]*))\s*\)/g;

// A remote's CSS resolves relative url() targets against its own public path.
// Inlining it into a route document would resolve them against the site base
// instead, so rewrite them to the absolute path the remote build published.
function absolutizeCssUrls(css: string, publicPath: string) {
  return css.replace(
    cssUrlPattern,
    (
      match: string,
      quoted: string | undefined,
      single: string | undefined,
      bare: string | undefined,
    ) => {
      /* v8 ignore next -- One of the three alternatives always participates in a match, so the final fallback only guards a future edit to cssUrlPattern. */
      const target = quoted ?? single ?? bare ?? "";
      if (target === "" || /^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(target))
        return match;
      return `url("${publicPath}${target}")`;
    },
  );
}

function mainStylesheetName(
  document: string,
  name: string,
  documentPath: string,
) {
  const names = [...document.matchAll(stylesheetLinkPattern)]
    .filter((match) => match[0].includes('rel="stylesheet"'))
    .map((match) => hrefPattern.exec(match[0])?.[1])
    .filter((href) => typeof href === "string")
    .map((href) => basename(href))
    .filter((file) => mainStylesheetPattern.test(file));
  const [stylesheet] = names;
  if (names.length !== 1 || stylesheet === undefined)
    throw new Error(
      `The built ${name} remote at ${documentPath} must link exactly one hashed main stylesheet; found ${names.length}. Run just check to rebuild every required remote before prerendering.`,
    );
  return stylesheet;
}

async function readRemoteCss(
  remoteRoot: string,
  name: string,
  pagesBase: string,
) {
  const directory = join(remoteRoot, name);
  const documentPath = join(directory, "index.html");
  let document: string;
  try {
    document = await readFile(documentPath, "utf8");
  } catch (error) {
    /* v8 ignore next -- Node rejects a failed read with an Error; the string branch only keeps a non-Error rejection readable. */
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Could not read the built ${name} remote document at ${documentPath}: ${detail}. Run just check to build every required remote before prerendering.`,
    );
  }
  const stylesheet = join(
    directory,
    mainStylesheetName(document, name, documentPath),
  );
  let css: string;
  try {
    css = await readFile(stylesheet, "utf8");
  } catch (error) {
    /* v8 ignore next -- Node rejects a failed read with an Error; the string branch only keeps a non-Error rejection readable. */
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Could not read the built ${name} page CSS at ${stylesheet}: ${detail}. Run just check to build every required remote before prerendering.`,
    );
  }
  if (/<\/style|<!--/i.test(css))
    throw new Error(
      `The built ${name} page CSS at ${stylesheet} contains markup that cannot be inlined safely. Remove the offending declaration from the remote's stylesheets and rerun just check.`,
    );
  return absolutizeCssUrls(css, `${pagesBase}/remotes/${name}/`);
}

export interface InlineRemoteStyle {
  css: string;
  names: string[];
}

// Several remotes re-bundle the shared design-system theme, so identical
// payloads are collapsed to one style element per route document.
export async function readRouteRemoteStyles({
  remoteRoot,
  pagesBase,
  routePath,
}: {
  remoteRoot: string;
  pagesBase: unknown;
  routePath: string;
}): Promise<InlineRemoteStyle[]> {
  const base = validatePagesBase(pagesBase);
  const styles = new Map<string, string[]>();
  for (const name of remotesForRoute(routePath)) {
    const css = await readRemoteCss(remoteRoot, name, base);
    const shared = styles.get(css);
    if (shared) shared.push(name);
    else styles.set(css, [name]);
  }
  return [...styles].map(([css, names]) => ({ css, names }));
}

export function renderInlineRemoteCss(
  styles: readonly InlineRemoteStyle[],
): string {
  return styles
    .map(
      ({ css, names }) =>
        `<style ${inlineRemoteCssAttribute}="${names.join(" ")}">${css}</style>`,
    )
    .join("");
}
