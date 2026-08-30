import { spawnSync } from "node:child_process";
import {
  appendFile,
  cp,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, expect, test } from "vitest";
// The gate validates the committed budgets at the boundary that reads them,
// and this spec reaches them through that same validator rather than through a
// type annotation over unchecked JSON: what it proves is then about the shape
// the gate itself accepted.
import { deriveCeiling, parseBundleBudgets } from "./bundle-budgets.mjs";

const artifact = "dist/apps/shell";
const budgetsPath = "scripts/artifact/bundle-budgets.json";
/** Where the CV domains this gate exists to keep out of a pane are vendored. */
const domainsDirectory = "libs/data-access-core/vendor/codegen/domains";

const fixtures: string[] = [];

afterAll(async () => {
  for (const fixture of fixtures)
    await rm(fixture, { recursive: true, force: true });
});

function readBudgets(path = budgetsPath) {
  return readFile(path, "utf8").then((source) =>
    parseBundleBudgets(JSON.parse(source), path),
  );
}

type Budgets = Awaited<ReturnType<typeof readBudgets>>;
type Ceiling = Budgets["routes"][string];

/**
 * Every ceiling a budget file declares, keyed by the thing it budgets, so two
 * files can be compared over what they budget rather than over a nesting shape.
 */
function ceilings(budgets: Budgets) {
  const byLabel = new Map<string, Ceiling>();
  for (const [app, budget] of Object.entries(budgets.apps)) {
    byLabel.set(`${app} eager entry`, budget.entry);
    if (budget.page) byLabel.set(`${app} ./Page chunk`, budget.page);
  }
  for (const [route, ceiling] of Object.entries(budgets.routes))
    byLabel.set(`route ${route}`, ceiling);
  return byLabel;
}

/** Re-derives a budget file over the composed artifact, into a fixture. */
async function rederive(source: string) {
  const fixture = await mkdtemp(join(tmpdir(), "bundle-budgets-rederive-"));
  fixtures.push(fixture);
  const path = join(fixture, "bundle-budgets.json");
  await cp(source, path);
  return { path, result: checkBudgets(artifact, path, "--rederive") };
}

/**
 * What this tree measures right now, read from the gate's own re-derivation
 * over the composed artifact. Every test that needs a byte count takes it from
 * here rather than from the committed file: a committed measurement records the
 * tree its ceiling was derived against, and a build that moves a handful of
 * bytes for reasons that have nothing to do with payload must not fail a test
 * that was never about those bytes. A committed *ceiling* is a different thing
 * — it is what the gate reads and reports — so those are still quoted from the
 * file.
 */
let measurement: Promise<Budgets> | undefined;
function measuredBudgets() {
  measurement ??= rederive(budgetsPath).then(({ path, result }) => {
    if (result.status !== 0)
      throw new Error(
        `--rederive could not measure the artifact: ${result.stderr}`,
      );
    return readBudgets(path);
  });
  return measurement;
}

/**
 * The smallest number of bytes a measurement can have grown by, since the
 * budget covering it was committed, that the file's one margin no longer
 * covers. Derived from the margin rather than restated, so a margin that moves
 * moves both halves of the pair of tests below with it.
 */
function pastMargin(measuredBytes: number, marginPercent: number) {
  return Math.ceil(
    measuredBytes - (measuredBytes - 1) / (1 + marginPercent / 100),
  );
}

/**
 * A budget file recording what this tree measures now, less `growth` bytes on
 * each ceiling: the file somebody would have committed back when the payload
 * was that much smaller. Whether this tree is still inside it is precisely the
 * question the margin exists to answer.
 */
async function budgetsPredatingGrowth(
  growth: (measuredBytes: number, label: string) => number,
) {
  const budgets = await measuredBudgets();
  const shrink = (ceiling: Ceiling, label: string) =>
    deriveCeiling(
      ceiling.measuredBytes - growth(ceiling.measuredBytes, label),
      budgets.marginPercent,
    );
  const written = {
    marginPercent: budgets.marginPercent,
    apps: Object.fromEntries(
      Object.entries(budgets.apps).map(([app, budget]) => [
        app,
        {
          entry: shrink(budget.entry, `${app} eager entry`),
          ...(budget.page
            ? { page: shrink(budget.page, `${app} ./Page chunk`) }
            : {}),
        },
      ]),
    ),
    routes: Object.fromEntries(
      Object.entries(budgets.routes).map(([route, ceiling]) => [
        route,
        shrink(ceiling, `route ${route}`),
      ]),
    ),
  };
  const fixture = await mkdtemp(join(tmpdir(), "bundle-budgets-predating-"));
  fixtures.push(fixture);
  const path = join(fixture, "bundle-budgets.json");
  await writeFile(path, JSON.stringify(written));
  return path;
}

/**
 * The smallest CV domain there is, derived rather than named: a margin that
 * cannot absorb the smallest one cannot absorb any of them, and a smaller
 * domain added later is picked up here instead of quietly going unproven.
 */
async function smallestDomain() {
  const sized = await Promise.all(
    (await readdir(domainsDirectory)).map(async (file) => {
      const path = join(domainsDirectory, file);
      return { path, bytes: (await stat(path)).size };
    }),
  );
  const [first, ...rest] = sized;
  if (!first) throw new Error(`${domainsDirectory} carries no CV domain`);
  return rest.reduce(
    (smallest, domain) => (domain.bytes < smallest.bytes ? domain : smallest),
    first,
  );
}

/**
 * The app whose `./Page` chunk is the largest the committed file budgets, read
 * from that file: it is the ceiling carrying the most headroom for a domain to
 * hide in, so it is the one the margin has to be proven against.
 */
function largestPageApp(budgets: Awaited<ReturnType<typeof readBudgets>>) {
  const budgeted = Object.entries(budgets.apps).flatMap(([app, budget]) =>
    budget.page ? [{ app, page: budget.page }] : [],
  );
  const [first, ...rest] = budgeted;
  if (!first) throw new Error(`${budgetsPath} budgets no ./Page chunk`);
  return rest.reduce(
    (largest, candidate) =>
      candidate.page.measuredBytes > largest.page.measuredBytes
        ? candidate
        : largest,
    first,
  );
}

/**
 * An isolated artifact whose every app subtree is linked to the composed build
 * output, except the ones a test corrupts: those are that fixture's own bytes,
 * so nothing here can write into shared build output.
 */
async function isolatedArtifact(copied: readonly string[]) {
  const fixture = await mkdtemp(join(tmpdir(), "bundle-budgets-"));
  fixtures.push(fixture);
  for (const entry of await readdir(artifact))
    if (entry !== "remotes")
      await symlink(resolve(artifact, entry), join(fixture, entry));
  await mkdir(join(fixture, "remotes"));
  for (const app of await readdir(join(artifact, "remotes"))) {
    const source = resolve(artifact, "remotes", app);
    const destination = join(fixture, "remotes", app);
    if (copied.includes(app))
      await cp(source, destination, { recursive: true });
    else await symlink(source, destination);
  }
  return fixture;
}

/** The one numbered chunk an app emits is the chunk its `./Page` resolves to. */
async function pageChunk(fixture: string, app: string) {
  const directory = join(fixture, "remotes", app);
  const chunks = (await readdir(directory)).filter((file) =>
    /^\d+\.[0-9a-f]+\.js$/.test(file),
  );
  expect(chunks).toHaveLength(1);
  return join(directory, chunks[0] ?? "");
}

function checkBudgets(root: string, budgets = budgetsPath, ...args: string[]) {
  return spawnSync(
    process.execPath,
    ["scripts/artifact/check-bundle-budgets.mjs", ...args],
    {
      env: {
        ...process.env,
        STATIC_ARTIFACT_ROOT: root,
        BUNDLE_BUDGETS: budgets,
      },
      encoding: "utf8",
    },
  );
}

test("the committed budgets hold over the artifact this tree composes", () => {
  const result = checkBudgets(artifact);

  expect(result.stderr).not.toContain("check-bundle-budgets:");
  expect(result.status).toBe(0);
});

test("a ./Page chunk over its ceiling is refused by app and by route", async () => {
  const fixture = await isolatedArtifact(["home-cards"]);
  await appendFile(await pageChunk(fixture, "home-cards"), "0".repeat(200_000));

  const result = checkBudgets(fixture);

  expect(result.status).not.toBe(0);
  const measured = (await measuredBudgets()).apps["home-cards"]?.page;
  const committed = (await readBudgets()).apps["home-cards"]?.page;
  expect(result.stderr).toContain(
    `home-cards ./Page chunk is ${(measured?.measuredBytes ?? 0) + 200_000} bytes, over its ${committed?.ceilingBytes}-byte ceiling`,
  );
  // The route budget is what per-app ceilings alone would have missed, so it
  // has to name the route it blew as well as the pane that grew.
  expect(result.stderr).toContain("route / composes");
});

// The margin this file commits to is only worth what it refuses. Re-adding the
// smallest CV domain to the largest budgeted `./Page` chunk is the cheapest
// version of the regression the budgets exist for, so a margin wide enough to
// let that through is one this suite refuses to let anyone commit.
test("re-adding one CV domain's data to a ./Page chunk is refused", async () => {
  const budgets = await readBudgets();
  const largest = largestPageApp(budgets);
  const domain = await smallestDomain();
  // The bound the committed margin has to sit under, derived from the same two
  // facts the append below uses, so neither can drift away from this proof.
  expect(budgets.marginPercent).toBeLessThan(
    (domain.bytes / largest.page.measuredBytes) * 100,
  );
  const fixture = await isolatedArtifact([largest.app]);
  await appendFile(
    await pageChunk(fixture, largest.app),
    await readFile(domain.path),
  );

  const result = checkBudgets(fixture);

  expect(result.status).not.toBe(0);
  const measured = (await measuredBudgets()).apps[largest.app]?.page;
  expect(result.stderr).toContain(
    `${largest.app} ./Page chunk is ${(measured?.measuredBytes ?? 0) + domain.bytes} bytes, over its ${largest.page.ceilingBytes}-byte ceiling`,
  );
});

// Measuring a `./Page` chunk means resolving chunk ids with the bundle's own
// resolver, so this gate evaluates an expression it read out of a build
// artifact. It is validated before it runs, and a resolver that reaches for
// anything but its own parameter is refused rather than evaluated.
test("a bundle resolver that reads a host global is refused, not evaluated", async () => {
  const fixture = await isolatedArtifact(["bio"]);
  const container = join(fixture, "remotes", "bio", "remoteEntry.js");
  const source = await readFile(container, "utf8");
  await writeFile(
    container,
    source.replace(
      "__webpack_require__.u=",
      "__webpack_require__.u=e=>process.env.HOME+",
    ),
  );

  const result = checkBudgets(fixture);

  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain("reads process, which is not its parameter");
});

// Naming only the parameter is not enough on its own, because a string literal
// is removed before the names are read: reaching a host global through a
// bracketed property and calling it names nothing else at all.
test("a bundle resolver that calls through a bracket is refused too", async () => {
  const fixture = await isolatedArtifact(["bio"]);
  const container = join(fixture, "remotes", "bio", "remoteEntry.js");
  const source = await readFile(container, "utf8");
  await writeFile(
    container,
    source.replace(
      "__webpack_require__.u=",
      '__webpack_require__.u=e=>e["constructor"]["constructor"]("return 1")()+',
    ),
  );

  const result = checkBudgets(fixture);

  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain(
    "indexes a value that is not the object literal before it",
  );
});

test("a budget file that omits an app the artifact contains is refused", async () => {
  const fixture = await mkdtemp(join(tmpdir(), "bundle-budgets-file-"));
  fixtures.push(fixture);
  const budgets = await readBudgets();
  delete budgets.apps["home-cards"];
  const path = join(fixture, "bundle-budgets.json");
  await writeFile(path, JSON.stringify(budgets));

  const result = checkBudgets(artifact, path);

  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain("declares no budget for home-cards");
});

// Raising a ceiling is meant to be a re-derivation somebody commits, so this
// drives that mode over the artifact the gate above just passed. What it owes
// is not that a byte count comes back equal to one written down earlier: a
// build moves by a handful of bytes for reasons that have nothing to do with
// payload, and a gate that fails on that teaches everyone to re-derive without
// reading the diff, which is the same as having no gate. It owes that the
// ceilings it derives and the ones committed describe the same tree — the same
// apps, kinds and routes, and each side's ceiling covering the other side's
// measurement at the one margin the file declares.
//
// It starts from a file whose measurements are all doubled, so a re-derivation
// that quietly left the file alone would fail every comparison below instead of
// passing them by having copied the answer in.
test("--rederive derives ceilings the committed ones still cover", async () => {
  const committed = await readBudgets();
  const doubled = await budgetsPredatingGrowth(
    (measuredBytes) => -measuredBytes,
  );

  const { path, result } = await rederive(doubled);

  expect(result.status).toBe(0);
  expect(result.stdout.trimEnd().split("\n")).toHaveLength(1);
  expect(result.stdout).toContain("re-derived");
  const rederived = await readBudgets(path);
  expect(rederived.marginPercent).toBe(committed.marginPercent);
  // Spreading already copies, so sorting in place here reorders nothing shared.
  expect([...ceilings(rederived).keys()].sort()).toEqual(
    [...ceilings(committed).keys()].sort(),
  );
  const declared = ceilings(committed);
  // Each file's ceiling has to cover the other file's measurement. A payload
  // that genuinely grew breaks the first half and a payload that genuinely
  // shrank breaks the second; a build that moved inside the declared margin
  // breaks neither, which is the whole point of declaring one.
  expect(
    [...ceilings(rederived)].flatMap(([label, fresh]) => {
      const before = declared.get(label);
      if (!before) return [`${label} is budgeted by only one of the two files`];
      return fresh.measuredBytes > before.ceilingBytes ||
        before.measuredBytes > fresh.ceilingBytes
        ? [
            `${label} measures ${fresh.measuredBytes} bytes now against ${before.measuredBytes} committed, which the ${committed.marginPercent}% margin does not cover`,
          ]
        : [];
    }),
  ).toEqual([]);
});

// The margin is what keeps the gate from firing on drift it was never meant to
// catch, so it is proven from both sides against a real re-measurement of this
// tree: budgets written when every bundle measured exactly as much less as the
// margin covers still pass over the artifact those bundles grew into.
test("growth the declared margin covers is not refused", async () => {
  const budgets = await measuredBudgets();
  const path = await budgetsPredatingGrowth(
    (measuredBytes) => pastMargin(measuredBytes, budgets.marginPercent) - 1,
  );
  // The file has to be the one this test means to gate against, so what it
  // declares is read back rather than assumed: every ceiling in it sits at or
  // above what this tree measures, and at least one of them moved at all.
  const written = ceilings(await readBudgets(path));
  const moved = [...ceilings(budgets)].filter(([label, measured]) => {
    expect(written.get(label)?.ceilingBytes).toBeGreaterThanOrEqual(
      measured.measuredBytes,
    );
    return written.get(label)?.measuredBytes !== measured.measuredBytes;
  });
  expect(moved.length).toBeGreaterThan(0);

  const result = checkBudgets(artifact, path);

  expect(result.stderr).not.toContain("check-bundle-budgets:");
  expect(result.status).toBe(0);
});

// And one byte past that margin is refused, so what the test above proves is a
// margin doing its job rather than a gate that never fires.
test("growth one byte past the declared margin is refused", async () => {
  const budgets = await measuredBudgets();
  // The largest eager entry this tree measures, derived rather than named: it
  // is the app with the most room for growth to hide in, so it is the one worth
  // moving one byte past what the margin forgives. Reducing without a seed
  // takes the entry's own type from the map, so no assertion is needed, and an
  // artifact that measured no eager entry at all fails here loudly rather than
  // budgeting a label that does not exist.
  const [grown, largest] = [...ceilings(budgets)]
    .filter(([label]) => label.endsWith(" eager entry"))
    .reduce((widest, entry) =>
      entry[1].measuredBytes > widest[1].measuredBytes ? entry : widest,
    );
  const measured = largest.measuredBytes;
  const path = await budgetsPredatingGrowth((measuredBytes, label) =>
    label === grown ? pastMargin(measuredBytes, budgets.marginPercent) : 0,
  );
  const ceiling =
    ceilings(await readBudgets(path)).get(grown)?.ceilingBytes ?? 0;
  expect(ceiling).toBeLessThan(measured);

  const result = checkBudgets(artifact, path);

  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain(
    `${grown} is ${measured} bytes, over its ${ceiling}-byte ceiling`,
  );
});

// A refusal names the step that clears it, so an unexpected failure has to as
// well: a budget file that is not JSON fails inside the JSON parser, which says
// nothing about this gate, and the reader is told what to do anyway.
test("a budget file that is not JSON still names the step that clears it", async () => {
  const fixture = await mkdtemp(join(tmpdir(), "bundle-budgets-unparsable-"));
  fixtures.push(fixture);
  const path = join(fixture, "bundle-budgets.json");
  await writeFile(path, "these are not the budgets you are looking for");

  const result = checkBudgets(artifact, path);

  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain("could not be read as expected");
  expect(result.stderr).toContain("rebuild with just prerender");
});

test("an unrecognised argument is refused rather than gated silently", () => {
  const result = checkBudgets(artifact, budgetsPath, "--print");

  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain("it was given --print");
});
