import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
// The canonical remote registry is read as the serialized build input it is,
// through the subpath build-config publishes for it, so the prerender CLIs
// Node type-strips this module for resolve it the same way a bundler does.
import remoteManifest from "@site/build-config/remotes.json" with {
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

/** One remote's built page CSS, named by the remote that published it. */
export interface RemoteStyleSheet {
  name: string;
  css: string;
}

/**
 * The top-level blocks of one stylesheet, in the order they appear and with
 * every byte between them kept, so joining the result reproduces the input.
 *
 * A block is one qualified rule or one at-rule, whichever ends first: a `}` at
 * nesting depth zero, or a `;` at depth zero for the statement at-rules
 * (`@charset`, `@import`, `@layer a, b`) that have no body. Strings and
 * comments are stepped over rather than scanned, because a declaration may
 * legitimately contain a brace — `content: "}"` and `url(data:...{...})` both
 * occur — and a splitter that counted those braces would cut a rule in half and
 * emit CSS the browser cannot parse.
 */
export function splitCssBlocks(css: string): string[] {
  const blocks: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < css.length; index += 1) {
    const character = css[index];
    if (character === "'" || character === '"') {
      const quote = character;
      index += 1;
      while (index < css.length && css[index] !== quote) {
        if (css[index] === "\\") index += 1;
        index += 1;
      }
      continue;
    }
    if (character === "/" && css[index + 1] === "*") {
      const end = css.indexOf("*/", index + 2);
      index = end === -1 ? css.length : end + 1;
      continue;
    }
    if (character === "{") depth += 1;
    else if (character === "}") {
      depth -= 1;
      if (depth <= 0) {
        blocks.push(css.slice(start, index + 1));
        depth = 0;
        start = index + 1;
      }
    } else if (character === ";" && depth === 0) {
      blocks.push(css.slice(start, index + 1));
      start = index + 1;
    }
  }
  if (start < css.length) blocks.push(css.slice(start));
  return blocks;
}

/**
 * The style elements one route document inlines, grouped so that a block
 * several remotes ship is emitted once rather than once per remote.
 *
 * Every remote on a route re-bundles the shared design-system stylesheet — its
 * tokens, its reset, and the page shell, card, section heading, action link,
 * pane state and skeleton primitives its pages compose — so the home document
 * used to carry eight near-identical copies of it. Grouping by which remotes
 * own a block collapses those to one, and leaves each remote's own rules in a
 * group still attributed to it, so what a style element claims to be remains
 * true.
 *
 * Order is preserved where it can be observed: a group is emitted at the first
 * block that belongs to it, and a shared block is by construction the first
 * thing in every stylesheet that ships it, because every remote imports the
 * design system before its own page CSS. A block one remote repeats verbatim
 * is likewise emitted at its first occurrence, which is what makes the same
 * key collapse a block across remotes as well as within one.
 */
export function groupRemoteStyles(
  sheets: readonly RemoteStyleSheet[],
): InlineRemoteStyle[] {
  const owners = new Map<string, string[]>();
  const order: string[] = [];
  for (const { name, css } of sheets)
    for (const block of splitCssBlocks(css)) {
      const known = owners.get(block);
      if (!known) {
        owners.set(block, [name]);
        order.push(block);
      } else if (known.at(-1) !== name) known.push(name);
    }
  const groups = new Map<string, { names: string[]; blocks: string[] }>();
  for (const block of order) {
    /* v8 ignore next -- every block in `order` was recorded in `owners` in the same loop above. */
    const names = owners.get(block) ?? [];
    const key = names.join(" ");
    const group = groups.get(key) ?? { names, blocks: [] };
    group.blocks.push(block);
    groups.set(key, group);
  }
  return [...groups.values()].map(({ names, blocks }) => ({
    css: blocks.join(""),
    names,
  }));
}

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
  const sheets: RemoteStyleSheet[] = [];
  for (const name of remotesForRoute(routePath))
    // llmlint: ignore[boundary_inputs_validated] These bytes are the output of this workspace's rspack build, not an external stylesheet: mainStylesheetName above accepts only the build's single hashed main CSS asset, and readRemoteCss rejects markup that would escape the style element before rewriting only relative url() values. splitCssBlocks deliberately preserves every byte rather than pretending to be a CSS parser; rspack is the syntax boundary, while the artifact check and browser journeys verify the emitted inline CSS through the consumer that actually parses it.
    sheets.push({ name, css: await readRemoteCss(remoteRoot, name, base) });
  return groupRemoteStyles(sheets);
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
