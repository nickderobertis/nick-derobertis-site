import { spawnSync } from "node:child_process";
import {
  appendFile,
  cp,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, expect, test } from "vitest";

const artifact = "dist/apps/shell";
const budgetsPath = "scripts/artifact/bundle-budgets.json";
/**
 * The smallest CV domain there is, so a margin that cannot absorb this one
 * cannot absorb any of them.
 */
const smallestDomain =
  "libs/data-access-core/vendor/codegen/domains/awards.json";
/**
 * The app whose `./Page` chunk is the largest this file budgets, so the one
 * whose ceiling carries the most headroom for a domain to hide in.
 */
const largestPageApp = "awards";

const fixtures: string[] = [];

afterAll(async () => {
  for (const fixture of fixtures)
    await rm(fixture, { recursive: true, force: true });
});

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

function checkBudgets(root: string, budgets = budgetsPath) {
  return spawnSync(
    process.execPath,
    ["scripts/artifact/check-bundle-budgets.mjs"],
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
  const budgets: {
    apps: Record<
      string,
      { page: { measuredBytes: number; ceilingBytes: number } }
    >;
  } = JSON.parse(await readFile(budgetsPath, "utf8"));
  const page = budgets.apps["home-cards"]?.page;
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
  const fixture = await isolatedArtifact([largestPageApp]);
  const chunk = await pageChunk(fixture, largestPageApp);
  await appendFile(chunk, await readFile(smallestDomain));

  const result = checkBudgets(fixture);

  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain(`${largestPageApp} ./Page chunk is`);
  expect(result.stderr).toContain("-byte ceiling");
});

test("a budget file that omits an app the artifact contains is refused", async () => {
  const fixture = await mkdtemp(join(tmpdir(), "bundle-budgets-file-"));
  fixtures.push(fixture);
  const budgets: { apps: Record<string, unknown> } = JSON.parse(
    await readFile(budgetsPath, "utf8"),
  );
  delete budgets.apps["home-cards"];
  const path = join(fixture, "bundle-budgets.json");
  await writeFile(path, JSON.stringify(budgets));

  const result = checkBudgets(artifact, path);

  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain("declares no budget for home-cards");
});
