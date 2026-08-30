import { readFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { routeSubstantiveContent } from "@site/artifact-contracts";
import { parseSiteRoutes } from "@site/route-state";

/**
 * Playwright's own role union. Declaring the contract with it keeps every
 * accessible assertion checked against a real ARIA role instead of an
 * unchecked string.
 */
export type AriaRole = Parameters<Page["getByRole"]>[0];

const routeManifest = "apps/shell/src/routes.json";
const remoteManifest = "libs/build-config/src/remotes.json";
const homeComposition = "apps/home/rspack.config.ts";
const contractSource = "libs/e2e-harness/src/site-contract.ts";
// The CV data every route the site builds from, which @site/artifact-contracts
// turns into the content each route has to show. Reading it here is what makes
// the browser journeys assert the CV the site was built from, rather than a
// copy of it that an ordinary CV edit would leave behind.
const cvDataSource = "libs/data-access-core/vendor/codegen";

/** What a visitor can observe on one of the site's published routes. */
export interface RouteContract {
  /** Route path relative to the Pages base; Home is the empty string. */
  path: RoutePath;
  /** Header link label the shell renders for this route. */
  link: string;
  /** Heading the route's own page shows. */
  heading: string;
  /**
   * Copy only this route's feature can supply, derived from the CV data the
   * site is built from by the same contract the compose-time gate reads.
   */
  feature: string;
  /** The empty view this route publishes through its own query parameter. */
  emptyView?: { query: string; heading: string };
}

// apps/shell/src/routes.json owns which routes the site publishes and how the
// header labels them; these are the accessible facts each of those routes shows
// a visitor. siteRoutes() joins the two and fails when either side drifts.
const routeContent = [
  {
    path: "",
    heading: "Finance researcher & educator",
  },
  {
    path: "bio",
    heading: "Optimizing Life",
    emptyView: { query: "bio-view=empty", heading: "Biography coming soon" },
  },
  {
    path: "research",
    heading: "Research Works",
    emptyView: {
      query: "research-scenario=empty",
      heading: "No research projects yet",
    },
  },
  {
    path: "software",
    heading: "Open-Source Software",
    emptyView: {
      query: "software-view=empty",
      heading: "No software projects to show",
    },
  },
  {
    path: "courses",
    heading: "Courses",
    emptyView: { query: "courses-view=empty", heading: "No courses to show" },
  },
] as const;

export type RoutePath = (typeof routeContent)[number]["path"];

/** The accessible facts one federated remote shows through both boundaries. */
export interface RemoteContract {
  /** Route the shell composes this remote into. */
  host: string;
  /** Path the remote publishes its own standalone document at. */
  standalone: string;
  role: AriaRole;
  name: string;
  loadingName: string;
  /** Query that holds the host route in this remote's loading state. */
  loadingQuery?: string;
}

// libs/build-config/src/remotes.json owns which remotes exist; this is the one
// place their landmarks and loading statuses are written down. remoteContract()
// joins the two, so a new remote cannot ship without an ownership journey and a
// retired one cannot leave a stale contract behind.
const remoteContracts = {
  home: {
    host: "",
    standalone: "remotes/home/",
    role: "heading",
    name: "Finance researcher & educator",
    loadingName: "Loading home",
  },
  "home-carousel": {
    host: "",
    standalone: "remotes/home-carousel/",
    role: "region",
    name: "Featured work",
    loadingName: "Loading featured work",
  },
  "home-cards": {
    host: "",
    standalone: "remotes/home-cards/",
    role: "region",
    name: "Areas of work",
    loadingName: "Loading areas of work",
  },
  "home-story": {
    host: "",
    standalone: "remotes/home-story/",
    role: "heading",
    name: "Who am I?",
    loadingName: "Loading story",
  },
  "home-contact": {
    host: "",
    standalone: "remotes/home-contact/",
    role: "heading",
    name: "Let’s build something useful.",
    loadingName: "Loading contact options",
  },
  bio: {
    host: "bio",
    standalone: "remotes/bio/",
    role: "heading",
    name: "Optimizing Life",
    loadingName: "Loading biography",
    loadingQuery: "bio-view=loading",
  },
  research: {
    host: "research",
    standalone: "remotes/research/",
    role: "heading",
    name: "Research Works",
    loadingName: "Loading research",
    loadingQuery: "research-scenario=loading",
  },
  software: {
    host: "software",
    standalone: "remotes/software/",
    role: "heading",
    name: "Open-Source Software",
    loadingName: "Loading software",
    loadingQuery: "software-view=loading",
  },
  courses: {
    host: "courses",
    standalone: "remotes/courses/",
    role: "heading",
    name: "Courses",
    loadingName: "Loading courses",
    loadingQuery: "courses-view=loading",
  },
  timeline: {
    host: "",
    standalone: "remotes/timeline/",
    role: "heading",
    name: "Educated and Experienced",
    loadingName: "Loading timeline",
  },
  skills: {
    host: "",
    standalone: "remotes/skills/",
    role: "heading",
    name: "Skilled in…",
    loadingName: "Loading skills",
  },
  awards: {
    host: "",
    standalone: "remotes/awards/",
    role: "heading",
    name: "Selected awards",
    loadingName: "Loading awards",
  },
} as const satisfies Record<string, RemoteContract>;

export type RemoteName = keyof typeof remoteContracts;

// The panes Home composes, in the order apps/home/rspack.config.ts declares
// them. homePanes() fails when that composition gains or loses a remote.
const homePaneRemotes = [
  "home-carousel",
  "home-cards",
  "home-story",
  "home-contact",
  "timeline",
  "skills",
  "awards",
] as const;

export type HomePaneRemote = (typeof homePaneRemotes)[number];

/** The messages a pane shows when its own data is empty or unavailable. */
export interface PaneStates {
  empty: string;
  error: string;
}

// The panes Home drives through its shared `state` query declare their empty
// and error copy here; the other three reach those states through their own
// query parameters and own that copy in their own suites.
const homePaneStates = {
  "home-carousel": {
    empty: "No featured stories are available yet.",
    error: "Featured stories could not be loaded.",
  },
  "home-cards": {
    empty: "No areas of work are available yet.",
    error: "Areas of work could not be loaded.",
  },
  "home-story": {
    empty: "No story is available yet.",
    error: "Nick’s story could not be loaded.",
  },
  "home-contact": {
    empty: "No contact options are available.",
    error: "Contact options could not be loaded.",
  },
} as const satisfies Partial<Record<HomePaneRemote, PaneStates>>;

export type StatefulPaneRemote = keyof typeof homePaneStates;

const paneStatesByRemote: Partial<Record<HomePaneRemote, PaneStates>> =
  homePaneStates;

export interface HomePaneContract extends RemoteContract {
  remote: HomePaneRemote;
  states?: PaneStates;
}

export interface StatefulPaneContract extends HomePaneContract {
  remote: StatefulPaneRemote;
  states: PaneStates;
}

function assertSameInventory(
  subject: string,
  declared: readonly string[],
  wired: readonly string[],
  source: string,
): void {
  const undeclared = wired.filter((name) => !declared.includes(name));
  const stale = declared.filter((name) => !wired.includes(name));
  if (undeclared.length === 0 && stale.length === 0) return;
  const reasons = [
    ...undeclared.map((name) => `${name} has no contract`),
    ...stale.map((name) => `${name} is no longer wired`),
  ];
  throw new Error(
    `The ${subject} in ${contractSource} disagrees with ${source}: ${reasons.join(", ")}. Align the two, then rerun just check`,
  );
}

/**
 * Every route the site publishes, joined to the accessible facts its journeys
 * assert. The header label comes from the route manifest, so a renamed link
 * reaches the journeys without a second edit.
 */
export function siteRoutes(root: string = process.cwd()): RouteContract[] {
  const published = parseSiteRoutes(
    JSON.parse(readFileSync(path.join(root, routeManifest), "utf8")),
  ).map((route) => ({ ...route, path: route.path.replace(/^\//, "") }));
  assertSameInventory(
    "route contracts",
    routeContent.map(({ path: routePath }) => routePath),
    published.map(({ path: routePath }) => routePath),
    routeManifest,
  );
  return published.map((route) => {
    const content = routeContent.find(
      ({ path: routePath }) => routePath === route.path,
    );
    /* v8 ignore next 2 -- assertSameInventory has already joined both sides. */
    if (!content)
      throw new Error(`No journey contract for the ${route.path} route`);
    const [feature] = routeSubstantiveContent(
      path.join(root, cvDataSource),
      `/${route.path}`,
    );
    /* v8 ignore next 2 -- routeSubstantiveContent throws before returning none. */
    if (feature === undefined)
      throw new Error(`No substantive content for the ${route.path} route`);
    return { ...content, link: route.label, feature };
  });
}

/**
 * One remote's accessible contract, checked against the remote manifest so a
 * remote and its ownership journey can never exist without each other.
 */
export function remoteContract(
  name: RemoteName,
  root: string = process.cwd(),
): RemoteContract {
  const published: unknown = JSON.parse(
    readFileSync(path.join(root, remoteManifest), "utf8"),
  );
  if (typeof published !== "object" || published === null)
    throw new Error(
      `${remoteManifest} must map every remote project name to its federation name; restore it, then rerun just check`,
    );
  assertSameInventory(
    "remote contracts",
    Object.keys(remoteContracts),
    Object.keys(published),
    remoteManifest,
  );
  return remoteContracts[name];
}

/**
 * The panes Home composes, checked against the remotes its build config
 * declares, so a pane added to the page cannot skip its journeys.
 */
export function homePanes(root: string = process.cwd()): HomePaneContract[] {
  const declaration = /remoteMap\(\[([^\]]*)\]\)/.exec(
    readFileSync(path.join(root, homeComposition), "utf8"),
  )?.[1];
  if (declaration === undefined)
    throw new Error(
      `${homeComposition} must declare the panes Home composes through remoteMap([...]); restore that call, then rerun just check`,
    );
  assertSameInventory(
    "Home pane contracts",
    homePaneRemotes,
    declaration.match(/[a-z][a-z0-9-]*/g) ?? [],
    homeComposition,
  );
  return homePaneRemotes.map((remote) => {
    const states = paneStatesByRemote[remote];
    return {
      remote,
      ...remoteContracts[remote],
      ...(states ? { states } : {}),
    };
  });
}

/** One Home pane whose empty and error states Home drives through a query. */
export function statefulHomePane(
  remote: StatefulPaneRemote,
  root: string = process.cwd(),
): StatefulPaneContract {
  homePanes(root);
  return { remote, ...remoteContracts[remote], states: homePaneStates[remote] };
}
