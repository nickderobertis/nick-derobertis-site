import { spawnSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
// This spec drives compose.mjs itself, which Node type-strips, so it reaches
// the same library modules through the same package specifiers the CLI
// resolves.
import { remotesForRoute } from "@site/artifact-contracts";
import {
  artifactHoldDirectory,
  holdArtifactRoot,
} from "@site/artifact-contracts/artifact-hold";
import { serializeFragmentContract } from "@site/build-config/fragment-contract";
import { publishableApps } from "@site/publish-config";
import { afterEach, expect, test } from "vitest";
import {
  compose,
  homePanes,
  routeFragments,
  validatedHydrationMetadata,
  validateFragmentContracts,
} from "./compose.mjs";

test("compose rejects independently published React version skew", () => {
  expect(() =>
    validateFragmentContracts([
      {
        schemaVersion: 1,
        name: "shell",
        react: "19.2.7",
        reactDom: "19.2.7",
        revision: "a11ce123",
      },
      {
        schemaVersion: 1,
        name: "awards",
        react: "19.3.0",
        reactDom: "19.2.7",
        revision: "b0b12345",
      },
    ]),
  ).toThrow(/React version skew.*shell.*19\.2\.7.*awards.*19\.3\.0/);
});

test("compose preserves router match delimiters while validating hydration", () => {
  const hydration =
    '<script>self.$_TSR={e(){}};$_TSR.router={matches:[{i:"\\0bio\\0"}]};$_TSR.e();document.currentScript.remove()</script>';
  expect(validatedHydrationMetadata(hydration, "/bio")).toBe(hydration);
});

test("composition maps stay aligned with federation and CSS ownership", async () => {
  const homeConfig = await readFile("apps/home/rspack.config.ts", "utf8");
  const homeFragmentPage = await readFile(
    "libs/build-config/src/home-fragment-page.tsx",
    "utf8",
  );
  const configuredPanes = /remoteMap\(\[([\s\S]*?)\]\)/u
    .exec(homeConfig)?.[1]
    ?.match(/"([^"]+)"/g)
    ?.map((name) => name.slice(1, -1));
  expect([...homePanes].sort()).toEqual(configuredPanes?.sort());
  const publishedSlots = [
    ...homeFragmentPage.matchAll(/data-published-fragment="([^"]+)"/g),
  ].map((match) => match[1]);
  expect(publishedSlots).toEqual(homePanes);
  for (const [route, names] of Object.entries(routeFragments))
    expect(names).toEqual(remotesForRoute(route));
});

const contentStores: string[] = [];

afterEach(async () => {
  await Promise.all(
    contentStores
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

const encode = (value: string) => Buffer.from(value).toString("base64");
const hydration =
  "<script>self.$_TSR={e(){}};$_TSR.router={matches:[]};$_TSR.e();document.currentScript.remove()</script>";
const shellRoutes = [
  { path: "/", heading: "Nick DeRobertis", slot: "home" },
  { path: "/bio", heading: "Bio", slot: "bio" },
  { path: "/research", heading: "Research", slot: "research" },
  { path: "/software", heading: "Software", slot: "software" },
  { path: "/courses", heading: "Courses", slot: "courses" },
];

function fragmentHtml(app: string, revision: string) {
  if (app === "shell")
    return shellRoutes
      .map(
        (route) =>
          `<template data-shell-route="${route.path}" data-route-heading="${encode(route.heading)}" data-route-description="${encode(`${route.heading} at revision ${revision}`)}" data-router-hydration="${encode(hydration)}"><div class="shell-frame"><template data-published-fragment="${route.slot}"></template></div></template>`,
      )
      .join("");
  if (app === "home")
    return `<div class="home-main">${homePanes
      .map((pane) => `<template data-published-fragment="${pane}"></template>`)
      .join("")}</div>`;
  return `<main class="${app}-page"><h1>${app}</h1><p>${app} at revision ${revision}</p></main>`;
}

/**
 * A content store as the publish lanes leave it: one directory per app holding
 * exactly the bytes that app published, each stamped with its own revision.
 */
async function writeContentStore(revisions: Record<string, string>) {
  const root = await mkdtemp(join(tmpdir(), "content-store-"));
  contentStores.push(root);
  const apps = join(root, "apps");
  for (const app of publishableApps) {
    const revision = revisions[app] ?? "0000001";
    const directory = join(apps, app);
    await mkdir(directory, { recursive: true });
    await Promise.all([
      // The bytes a browser actually fetches: a publish lane stores its app's
      // whole build output, and compose is the only thing that can put them in
      // the served artifact.
      writeFile(join(directory, `main.${revision}.js`), `//${app}\n`),
      writeFile(join(directory, "remoteEntry.js"), `//${app} container\n`),
      writeFile(join(directory, "fragment.html"), fragmentHtml(app, revision)),
      writeFile(
        join(directory, "fragment.css"),
        `.${app}-page{--published-revision:"${revision}"}`,
      ),
      writeFile(
        join(directory, "fragment.json"),
        serializeFragmentContract({
          schemaVersion: 1,
          name: app,
          react: "19.2.7",
          reactDom: "19.2.7",
          revision,
        }),
      ),
      writeFile(
        join(directory, "index.html"),
        app === "shell"
          ? `<!doctype html><html lang="en"><head><title>Nick DeRobertis</title><meta name="description" content="placeholder"><link rel="canonical" href="https://nickderobertis.github.io/nick-derobertis-site/stale"><link rel="stylesheet" href="/nick-derobertis-site/main.abcdef1.css"><script defer src="/nick-derobertis-site/main.js"></script></head><body><div id="root" data-prerendered-route="/">stale markup</div></body></html>`
          : `<!doctype html><html lang="en"><head><title>${app}</title></head><body><div id="root"></div></body></html>`,
      ),
    ]);
  }
  return { root, apps, output: join(root, "site") };
}

test("compose assembles a coherent site when one app's fragment is newer", async () => {
  const store = await writeContentStore({ awards: "beefbee" });

  await compose({ fragmentRoot: store.apps, output: store.output });

  const home = await readFile(join(store.output, "index.html"), "utf8");
  // The newer awards bytes reach both the composed home route and the
  // standalone awards remote, while every other pane keeps its own revision.
  expect(home).toContain("<p>awards at revision beefbee</p>");
  expect(home).toContain('.awards-page{--published-revision:"beefbee"}');
  expect(home).toContain("<p>skills at revision 0000001</p>");
  expect(home).toContain('.skills-page{--published-revision:"0000001"}');
  expect(home).toContain('<div class="home-main">');
  expect(home).not.toContain("data-published-fragment");
  expect(home).not.toContain("stale markup");
  expect(home).toContain("<title>Nick DeRobertis</title>");
  expect(home).toContain(
    '<link rel="canonical" href="https://nickderobertis.github.io/nick-derobertis-site/">',
  );
  expect(home.indexOf("<style data-prerender-remote-css")).toBeLessThan(
    home.indexOf("<script defer"),
  );
  expect(
    await readFile(
      join(store.output, "remotes", "awards", "index.html"),
      "utf8",
    ),
  ).toContain("<p>awards at revision beefbee</p>");

  for (const [routePath, names] of Object.entries(routeFragments)) {
    const directory =
      routePath === "/" ? store.output : join(store.output, routePath.slice(1));
    const document = await readFile(join(directory, "index.html"), "utf8");
    expect(document).toContain("$_TSR.router=");
    expect(document).toContain(
      routePath === "/"
        ? '<div class="home-main">'
        : `<p>${names[0]} at revision`,
    );
    expect(document).toContain(
      `<link rel="canonical" href="https://nickderobertis.github.io/nick-derobertis-site${routePath}">`,
    );
  }
  expect(await readFile(join(store.output, "404.html"), "utf8")).toContain(
    "Loading requested page",
  );
});

test("compose stages every app's bundle and withholds its fragment inputs", async () => {
  const store = await writeContentStore({ shell: "5ce11ed", bio: "b10b10b" });

  await compose({ fragmentRoot: store.apps, output: store.output });

  // The shell's bundle belongs at the artifact root, because that is where the
  // composed documents reference it from.
  expect(await readdir(store.output)).toEqual(
    expect.arrayContaining(["main.5ce11ed.js", "remoteEntry.js"]),
  );
  expect(await readdir(join(store.output, "remotes", "bio"))).toEqual(
    expect.arrayContaining(["main.b10b10b.js", "remoteEntry.js"]),
  );
  // fragment.html, fragment.css, and fragment.json are compose's inputs, so no
  // served subtree ships them.
  const staged = await Promise.all(
    [store.output, join(store.output, "remotes", "bio")].map((directory) =>
      readdir(directory),
    ),
  );
  for (const entries of staged)
    expect(entries.filter((name) => name.startsWith("fragment."))).toEqual([]);
});

/**
 * The composer as `shell:prerender` runs it, which is the only path that claims
 * the artifact it writes into: the exported API above is reached with a caller
 * that already owns its output.
 */
// llmlint: ignore-block[work_goes_through_command_surface] The CLI boundary is the subject here — the exit status and the stderr this entry point answers a refused claim with — and this is the command surface the collision happens through: `shell:prerender` runs `node scripts/compose/compose.mjs` itself. The `just compose` recipe is the deploy lane's separate entry: it confines its output beneath dist/, so it cannot be pointed at the isolated artifact these cases own, and it reprints the CLI's stderr beneath its own line rather than emitting it, so routing through it would stop proving what this CLI says.
function runComposeCommand(fragmentRoot: string, output: string) {
  return spawnSync(
    process.execPath,
    [
      "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
      "scripts/compose/compose.mjs",
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        COMPOSE_OUTPUT: output,
        FRAGMENT_ROOT: fragmentRoot,
      },
    },
  );
}
// llmlint: ignore-end[work_goes_through_command_surface]

// Two overlapping runs over one working tree are what Nx cannot order: `e2e`
// depends on `prerender` inside a dispatch, but a second `just check` composes
// `dist/apps/shell` while the first run's Playwright servers are still reading
// it, and the browser reports that only as missing headings and unpainted
// remote styling.
test("the compose CLI refuses to replace an artifact another run is serving", async () => {
  const store = await writeContentStore({});
  await mkdir(store.output, { recursive: true });
  const served = join(store.output, "index.html");
  await writeFile(served, "the document the other run is serving");
  const release = holdArtifactRoot(store.output, "serving");

  try {
    const refused = runComposeCommand(store.apps, store.output);

    expect(refused.status).not.toBe(0);
    expect(refused.stderr).toContain(
      `held by process ${process.pid}, which is serving it`,
    );
    // Refused before the first write, so the run that is serving these bytes
    // keeps reading the ones it started with.
    expect(await readFile(served, "utf8")).toBe(
      "the document the other run is serving",
    );
  } finally {
    release();
  }
});

test("the compose CLI composes once the run serving the artifact has released it", async () => {
  const store = await writeContentStore({});
  holdArtifactRoot(store.output, "serving")();

  const composed = runComposeCommand(store.apps, store.output);

  expect(composed.status, `${composed.stdout}${composed.stderr}`).toBe(0);
  expect(await readFile(join(store.output, "index.html"), "utf8")).toContain(
    'data-prerendered-route="/"',
  );
});

// A record is pruned only when some later run scans the directory it is in, so
// a claim this CLI kept is still there after it has exited. The release is in a
// `finally`, which is what a compose that threw halfway through its inputs
// needs: it holds the artifact from before its first write, and a claim left
// behind would refuse the next `just check` on this machine for a run that is
// already over.
test("the compose CLI drops its claim whether or not it composed", async () => {
  const store = await writeContentStore({});
  const holds = artifactHoldDirectory(store.output);

  const composed = runComposeCommand(store.apps, store.output);

  expect(composed.status, `${composed.stdout}${composed.stderr}`).toBe(0);
  expect(await readdir(holds)).toEqual([]);

  await rm(join(store.apps, "courses"), { recursive: true, force: true });
  const failed = runComposeCommand(store.apps, store.output);

  expect(failed.status).not.toBe(0);
  expect(await readdir(holds)).toEqual([]);
});

test("compose refuses a content store that is missing an app's published bytes", async () => {
  const store = await writeContentStore({});
  await rm(join(store.apps, "courses"), { recursive: true, force: true });

  await expect(
    compose({ fragmentRoot: store.apps, output: store.output }),
  ).rejects.toThrow(/Could not read the published courses fragment/);
});
