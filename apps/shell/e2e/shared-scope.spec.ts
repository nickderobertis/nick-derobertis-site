import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { sharedSingletons } from "@site/build-config";
import { z } from "zod";

// llmlint: ignore-file[browser_journeys_run_against_the_built_app] This workspace deliberately owns browser journeys on each app rather than in separate e2e projects. `shell:e2e` depends on `shell:prerender`, and this spec drives that composed production artifact plus its built standalone bio remote, never a development server.
// llmlint: ignore-file[expensive_tests_stay_behind_their_own_edge] The share-scope contract is observable only after the shell composes the federated production artifact, so its browser proof belongs behind the shell's existing e2e edge; `just check` dispatches that edge once for the affected range rather than making unrelated projects own or repeat it.
// llmlint: ignore-block[tests_mirror_real_usage] "One container evaluated this library and the rest used that instance" is a statement about module instances, and a page renders identically either way — eight copies of a stateless library and one produce the same DOM, which is why this duplication went unnoticed long enough to become issue #92. Module Federation's share scope is where a page records which instance each container resolved, so that is what these journeys read. Every navigation is a real one against the composed artifact, and each test also asserts what a visitor sees and that nothing threw.

/**
 * One entry of Module Federation's share scope, which is where the runtime
 * records the instance a container resolved a shared module to. `from` names
 * the container whose copy was evaluated and `useIn` the containers using it,
 * so a library the whole page shares has one entry naming one provider.
 */
const shareEntrySchema = z.object({
  package: z.string().min(1),
  version: z.string().min(1),
  from: z.string().min(1),
  loaded: z.boolean(),
  useIn: z.array(z.string().min(1)),
});
type ShareEntry = z.infer<typeof shareEntrySchema>;

declare global {
  interface Window {
    __FEDERATION__?: {
      __SHARE__?: Record<
        string,
        Record<
          string,
          Record<
            string,
            Record<
              string,
              { from?: string; lib?: unknown; useIn?: readonly string[] }
            >
          >
        >
      >;
    };
  }
}

/**
 * Every instance the page's containers resolved a shared module to, collected
 * from all of their share scopes at once. A container that evaluated its own
 * copy appears here as a second entry naming itself, which is what separates
 * one instance for the page from one instance per container.
 */
async function resolvedShares(page: Page): Promise<ShareEntry[]> {
  const entries = await page.evaluate(() => {
    const containers = window.__FEDERATION__?.__SHARE__ ?? {};
    const seen = new Map<string, unknown>();
    for (const scopes of Object.values(containers))
      for (const packages of Object.values(scopes))
        for (const [name, versions] of Object.entries(packages))
          for (const [version, entry] of Object.entries(versions))
            seen.set(`${name}@${version}@${entry.from ?? ""}`, {
              package: name,
              version,
              from: entry.from ?? "",
              loaded: Boolean(entry.lib),
              useIn: [...(entry.useIn ?? [])],
            });
    return [...seen.values()];
  });
  return z.array(shareEntrySchema).parse(entries);
}

const federationManifestSchema = z.object({
  shared: z
    .array(z.object({ name: z.string().min(1), singleton: z.literal(true) }))
    .nonempty(),
});

// react and react-dom are excluded throughout: they are the eager pair, so
// their code is in every container's own entry chunk by design, and these
// journeys are about the non-eager shares beside them.
const eagerShares = new Set(
  Object.entries(sharedSingletons)
    .filter(([, config]) => "eager" in config && config.eager)
    .map(([name]) => name),
);

/**
 * The non-eager shares one built container declares, read from the manifest
 * that container's own build published rather than listed again here, so a
 * share added to libs/build-config/src/rspack-remote.ts is one these journeys
 * start requiring a single instance of.
 */
function declaredShares(app: string) {
  return federationManifestSchema
    .parse(
      JSON.parse(readFileSync(`dist/apps/${app}/mf-manifest.json`, "utf8")),
    )
    .shared.map(({ name }) => name)
    .filter((name) => !eagerShares.has(name))
    .sort();
}

/** The containers whose remoteEntry.js the page fetched. */
function recordContainers(page: Page) {
  const containers = new Set<string>();
  page.on("response", (response) => {
    const container = /\/remotes\/([a-z][a-z0-9-]*)\/remoteEntry\.js$/.exec(
      new URL(response.url()).pathname,
    )?.[1];
    if (container !== undefined) containers.add(container);
  });
  return () => [...containers].sort();
}

/**
 * Reports when the artifact has stopped fetching. A document reaches
 * `networkidle` once, and Home's seven panes are still arriving when that
 * window closes, so reading the share scope then would read it before most of
 * the page's containers had resolved anything. Install this before a
 * navigation and await it after.
 */
function watchTraffic(page: Page) {
  let inFlight = 0;
  let settled = 0;
  const started = () => {
    inFlight += 1;
  };
  const finished = () => {
    inFlight -= 1;
    settled += 1;
  };
  page.on("request", started);
  page.on("requestfinished", finished);
  page.on("requestfailed", finished);
  return async () => {
    await expect.poll(() => settled).toBeGreaterThan(0);
    await expect
      .poll(async () => {
        const before = settled;
        await page.waitForTimeout(500);
        return inFlight === 0 && settled === before;
      })
      .toBe(true);
    page.off("request", started);
    page.off("requestfinished", finished);
    page.off("requestfailed", finished);
  };
}

const instancesOf = (shares: readonly ShareEntry[], name: string) =>
  shares
    .filter((share) => share.package === name)
    .map(({ from, loaded }) => `${from} loaded=${loaded}`)
    .sort();

test("the entry route's containers all resolve one instance of each shared library", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const containers = recordContainers(page);
  const settle = watchTraffic(page);

  await page.goto("", { waitUntil: "networkidle" });
  await settle();

  // Home and its seven panes, which is what makes this the route issue #92
  // measured the duplication on.
  expect(containers()).toHaveLength(8);
  const shares = await resolvedShares(page);
  const shared = declaredShares("shell");
  expect(shared).not.toHaveLength(0);
  // One entry, from the host, already evaluated: one instance for the page
  // rather than one per container.
  for (const name of shared)
    expect(instancesOf(shares, name), `instances of ${name} on /`).toEqual([
      "shell loaded=true",
    ]);
  // Containers other than the host resolved to those instances, so the eight
  // above really did share rather than each miss the scope.
  const consumers = new Set(
    shares.flatMap(({ useIn }) => useIn).filter((name) => name !== "shell"),
  );
  expect([...consumers].length).toBeGreaterThan(1);
  // The counts above are only about libraries the route really used, so these
  // say the route rendered through those eight containers.
  await expect(
    page.getByRole("region", { name: "Featured work" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Who am I?" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Selected awards" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("a container with no host to share from renders from its own copy", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const containers = recordContainers(page);
  const settle = watchTraffic(page);

  await page.goto("remotes/bio/", { waitUntil: "networkidle" });
  await settle();

  await expect(
    page.getByRole("heading", { level: 1, name: "Optimizing Life" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  // Nothing supplied this document a share scope, so what it resolved and
  // rendered from is the fallback copy its own build kept — still one, not two.
  expect(containers()).toEqual(["bio"]);
  const shares = await resolvedShares(page);
  for (const name of declaredShares("bio"))
    expect(
      instancesOf(shares, name),
      `instances of ${name} standalone`,
    ).toEqual(["bio loaded=true"]);
});

// The composed documents carry their CSS inline, which is what paints the site
// before any script runs. Sharing the design system moved its rules out of each
// app's own stylesheet and into the chunk the share scope resolves, so this is
// what says the fragment those documents inline still carries them.
test.describe("with JavaScript disabled", () => {
  test.use({ javaScriptEnabled: false });

  test("the entry route is painted by the design system before a script runs", async ({
    page,
  }) => {
    const theme = readFileSync("libs/design-system/src/theme.css", "utf8");
    const [, property, value] =
      /(--[a-z-]+):\s*(#[0-9a-f]{3,8});/.exec(theme) ?? [];
    if (property === undefined || value === undefined)
      throw new Error(
        "libs/design-system/src/theme.css must declare a colour custom property for this journey to recognise the theme by; add one, then rerun just test-e2e",
      );

    await page.goto("");

    await expect(
      page.getByRole("heading", { name: "Finance researcher & educator" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        (token) =>
          getComputedStyle(document.documentElement)
            .getPropertyValue(token)
            .trim(),
        property,
      ),
    ).toBe(value);
  });
});
// llmlint: ignore-end[tests_mirror_real_usage]
