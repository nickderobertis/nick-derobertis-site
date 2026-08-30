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
import { parseBundleBudgets } from "./bundle-budgets.mjs";

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
  const page = (await readBudgets()).apps["home-cards"]?.page;
  expect(result.stderr).toContain(
    `home-cards ./Page chunk is ${(page?.measuredBytes ?? 0) + 200_000} bytes, over its ${page?.ceilingBytes}-byte ceiling`,
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
  expect(result.stderr).toContain(
    `${largest.app} ./Page chunk is ${largest.page.measuredBytes + domain.bytes} bytes, over its ${largest.page.ceilingBytes}-byte ceiling`,
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
// drives that mode over the artifact the gate above just passed: it has to
// reproduce the committed ceilings exactly, which is what makes the committed
// file a record of this tree rather than of the one it was written against.
test("--rederive reproduces the committed ceilings from this tree", async () => {
  const fixture = await mkdtemp(join(tmpdir(), "bundle-budgets-rederive-"));
  fixtures.push(fixture);
  const path = join(fixture, "bundle-budgets.json");
  await cp(budgetsPath, path);

  const result = checkBudgets(artifact, path, "--rederive");

  expect(result.status).toBe(0);
  expect(result.stdout.trimEnd().split("\n")).toHaveLength(1);
  expect(result.stdout).toContain("re-derived");
  expect(await readBudgets(path)).toEqual(await readBudgets());
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
