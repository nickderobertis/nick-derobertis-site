import { readFileSync } from "node:fs";

/**
 * The substantive content one route's document has to carry.
 *
 * Two consumers read this: the compose-time gate, which refuses a prerendered
 * document that does not contain its route's content, and `@site/e2e-harness`,
 * whose route contract hands the same content to the browser journeys that
 * drive every route through its prerendered, hydrated, and standalone-remote
 * boundaries. One source is what keeps the gate from asserting something no
 * browser has ever been shown.
 */

/**
 * Copy a route's own remote writes, for the routes that render no CV data.
 *
 * Home shows the story pane's heading and Bio the prose it owns; neither reads
 * a CV domain, so there is nothing under `cv-data` to derive their content
 * from. These move when the remote that writes them does.
 */
export const routeProseContent: Readonly<Record<string, string>> = {
  "/": "Who am I?",
  "/bio": "Reproducible Research",
};

/** How one route's CV domain titles the entries that route renders. */
interface CvDomain {
  /** The domain file, relative to a staged CV data root. */
  file: string;
  /** Every title the domain carries, in the order the file lists them. */
  titles: (data: unknown) => string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * The first non-empty string each entry carries under one of `keys`.
 *
 * Anything that is not a list of entries titled that way yields nothing, and
 * `routeSubstantiveContent` turns that into a diagnostic naming the file,
 * rather than an assertion that silently passes every document.
 */
function entryTitles(value: unknown, keys: readonly string[]): string[] {
  return (Array.isArray(value) ? value : []).flatMap((entry: unknown) => {
    for (const key of keys) {
      const title = isRecord(entry) ? entry[key] : undefined;
      if (typeof title === "string" && title.length > 0) return [title];
    }
    return [];
  });
}

// Naming the titles themselves here would fail the gate on an ordinary CV edit
// — a new paper, a renamed course — for a reason that has nothing to do with
// the artifact, so each route names only the domain file it renders and how
// that file titles its entries.
const routeCvDomains: Readonly<Record<string, CvDomain>> = {
  "/research": {
    file: "domains/research.json",
    titles: (data) =>
      entryTitles(isRecord(data) ? data.projects : undefined, ["title"]),
  },
  // ProjectCard titles a project by its display name, falling back to the
  // package's own name for the projects that carry none.
  "/software": {
    file: "domains/software_projects.json",
    titles: (data) => entryTitles(data, ["display_name", "name"]),
  },
  "/courses": {
    file: "domains/courses.json",
    titles: (data) => entryTitles(data, ["title"]),
  },
};

/**
 * What a visitor has to be able to read on `routePath`, in the order the CV
 * lists it: the route's own prose when its remote renders no CV data, and
 * otherwise every title the route's CV domain carries, read from `cvDataRoot`.
 *
 * `cvDataRoot` is the staged CV data — `cv-data` inside a composed artifact,
 * `libs/data-access-core/vendor/codegen` in the workspace — so the content
 * asserted is always the content that artifact was built from.
 */
export function routeSubstantiveContent(
  cvDataRoot: string,
  routePath: string,
): string[] {
  const prose = routeProseContent[routePath];
  if (prose !== undefined) return [prose];
  const domain = routeCvDomains[routePath];
  if (domain === undefined)
    throw new Error(
      `${routePath} has no substantive content to check; give it a CV domain in routeCvDomains, or a marker in routeProseContent if its remote renders no CV data, in libs/artifact-contracts/src/route-content.ts and rerun just check.`,
    );
  const file = `${cvDataRoot}/${domain.file}`;
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(
      `Could not read the CV data at ${file}: ${String(error)}. Rebuild the CV data artifact and rerun just prerender.`,
    );
  }
  const titles = [...new Set(domain.titles(parsed))];
  if (titles.length === 0)
    throw new Error(
      `${file} carries no titles for ${routePath}; rebuild the CV data artifact and rerun just prerender.`,
    );
  return titles;
}
