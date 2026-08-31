import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, expect, test } from "vitest";
import {
  homePanes,
  remoteContract,
  siteRoutes,
  statefulHomePane,
} from "./site-contract.ts";

const fixtures: string[] = [];

afterAll(async () => {
  for (const fixture of fixtures)
    await rm(fixture, { recursive: true, force: true });
});

interface FixtureOverrides {
  routes?: string;
  remotes?: string;
  homeConfig?: string;
}

const routeManifest = "apps/shell/src/routes.json";
const remoteManifest = "libs/build-config/src/remotes.json";
const homeComposition = "apps/home/rspack.config.ts";

/** A workspace whose three wiring sources can each be perturbed on their own. */
async function fixtureRoot(overrides: FixtureOverrides = {}): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "site-contract-"));
  fixtures.push(root);
  for (const [file, override] of [
    [routeManifest, overrides.routes],
    [remoteManifest, overrides.remotes],
    [homeComposition, overrides.homeConfig],
  ] as const) {
    const target = path.join(root, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, override ?? (await readFile(file, "utf8")));
  }
  return root;
}

test("publishes the accessible contract of every route the shell serves", () => {
  expect(siteRoutes()).toEqual([
    expect.objectContaining({ path: "", link: "Home" }),
    expect.objectContaining({
      path: "bio",
      link: "Bio",
      heading: "Optimizing Life",
      emptyView: { query: "bio-view=empty", heading: "Biography coming soon" },
    }),
    expect.objectContaining({ path: "research", link: "Research" }),
    expect.objectContaining({ path: "software", link: "Software" }),
    expect.objectContaining({ path: "courses", link: "Courses" }),
  ]);
});

// The routes that render a CV domain each show every entry that domain lists,
// so the contract that hands them to the browser journeys has to carry all of
// them: one title per course, per paper, per project, not just the first.
test("carries every title the CV data gives a route that renders a domain", () => {
  const routes = siteRoutes();
  const featuresOf = (published: string) =>
    routes.find(({ path: routePath }) => routePath === published)?.features;

  // Home and Bio render no CV domain, so their own remote's prose is all a
  // journey has to read on them.
  expect(featuresOf("")).toEqual(["Who am I?"]);
  expect(featuresOf("bio")).toEqual(["Reproducible Research"]);
  // The other three each list more than one entry, so a contract that stopped
  // at the first would leave the rest of the route unproven.
  expect(featuresOf("research")?.length).toBeGreaterThan(1);
  expect(featuresOf("software")?.length).toBeGreaterThan(1);
  expect(featuresOf("courses")?.length).toBeGreaterThan(1);
  for (const { features, link } of routes)
    for (const feature of features) expect(feature, link).not.toBe("");
});

test("rejects a route the shell publishes without a journey contract", async () => {
  const routes = JSON.parse(await readFile(routeManifest, "utf8"));
  const root = await fixtureRoot({
    routes: JSON.stringify([
      ...routes,
      {
        path: "/talks",
        label: "Talks",
        heading: "Talks",
        description: "Talks",
      },
    ]),
  });
  expect(() => siteRoutes(root)).toThrow("talks has no contract");
});

test("rejects a contracted route the shell no longer publishes", async () => {
  const routes = JSON.parse(await readFile(routeManifest, "utf8")).filter(
    (route: { path: string }) => route.path !== "/courses",
  );
  const root = await fixtureRoot({ routes: JSON.stringify(routes) });
  expect(() => siteRoutes(root)).toThrow("courses is no longer wired");
});

test("gives every remote the workspace federates an ownership contract", () => {
  expect(remoteContract("awards")).toEqual({
    host: "",
    standalone: "remotes/awards/",
    role: "heading",
    name: "Selected awards",
    loadingName: "Loading awards",
    loadingQuery: "awards-scenario=loading",
  });
  expect(remoteContract("bio").loadingQuery).toBe("bio-view=loading");
});

test("rejects a federated remote with no ownership contract", async () => {
  const remotes = JSON.parse(await readFile(remoteManifest, "utf8"));
  const root = await fixtureRoot({
    remotes: JSON.stringify({ ...remotes, talks: "talks" }),
  });
  expect(() => remoteContract("home", root)).toThrow("talks has no contract");
});

test("rejects a remote manifest that is not a map of remote names", async () => {
  const root = await fixtureRoot({ remotes: '"home"' });
  expect(() => remoteContract("home", root)).toThrow(remoteManifest);
});

test("derives Home's panes from the composition its build config declares", () => {
  expect(homePanes().map(({ remote }) => remote)).toEqual([
    "home-carousel",
    "home-cards",
    "home-story",
    "home-contact",
    "timeline",
    "skills",
    "awards",
  ]);
  expect(homePanes().find(({ remote }) => remote === "skills")?.states).toBe(
    undefined,
  );
  expect(statefulHomePane("home-cards").states).toEqual({
    empty: "No areas of work are available yet.",
    error: "Areas of work could not be loaded.",
  });
});

test("rejects a pane Home composes without a pane contract", async () => {
  const config = await readFile(homeComposition, "utf8");
  const root = await fixtureRoot({
    homeConfig: config.replace('"awards",', '"awards",\n    "talks",'),
  });
  expect(() => homePanes(root)).toThrow("talks has no contract");
});

test("rejects a contracted pane Home no longer composes", async () => {
  const config = await readFile(homeComposition, "utf8");
  const root = await fixtureRoot({
    homeConfig: config.replace('"skills",', ""),
  });
  expect(() => homePanes(root)).toThrow("skills is no longer wired");
});

test("rejects a Home composition that lost every pane", async () => {
  const config = await readFile(homeComposition, "utf8");
  const root = await fixtureRoot({
    homeConfig: config.replace(/remoteMap\(\[[^\]]*\]\)/, "remoteMap([])"),
  });
  expect(() => homePanes(root)).toThrow("awards is no longer wired");
});

test("rejects a Home build config that declares no composition", async () => {
  const root = await fixtureRoot({ homeConfig: "export default {};\n" });
  expect(() => homePanes(root)).toThrow(homeComposition);
});
