import { spawnSync } from "node:child_process";
import {
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
import { siteBase } from "@site/data-access-core";
import { afterAll, beforeAll, expect, test } from "vitest";

let fixture: string;
const corruptibleRemote = "bio";
/** Every fixture built here, torn down together once the file is done. */
const fixtures: string[] = [];

/**
 * A complete artifact of this run's own, assembled beside the shared build
 * output rather than out of it: every document a test rewrites is the
 * fixture's own bytes, and everything it only reads is linked.
 *
 * `writableSubtrees` names the parts a caller is going to change — the remote
 * whose asset one test removes, the `cv-data` another test renames a course
 * in — so those arrive as copies. Nothing any test does can reach
 * `dist/apps/shell`, which the e2e suites serve from at the same time.
 */
async function createArtifactFixture(
  writableSubtrees: readonly string[] = [],
): Promise<string> {
  const built = await mkdtemp(join(tmpdir(), "static-artifact-"));
  fixtures.push(built);
  const stage = async (name: string) => {
    const source = resolve("dist/apps/shell", name);
    const destination = join(built, name);
    if (writableSubtrees.includes(name))
      await cp(source, destination, { recursive: true });
    else await symlink(source, destination);
  };
  for (const route of ["", "bio", "research", "software", "courses"]) {
    const destination = join(built, route);
    await mkdir(destination, { recursive: true });
    await cp(
      join("dist/apps/shell", route, "index.html"),
      join(destination, "index.html"),
    );
  }
  await cp("dist/apps/shell/404.html", join(built, "404.html"));
  await stage("cv-data");
  await mkdir(join(built, "remotes"), { recursive: true });
  for (const name of await readdir("dist/apps/shell/remotes"))
    await stage(join("remotes", name));
  // The composed documents copied above reference the shell's bundle at the
  // artifact root, so the fixture is only a complete artifact once those bytes
  // are reachable. Linking whatever the shell build emitted, rather than a list
  // of hashed names, keeps this fixture correct across rebuilds.
  for (const entry of await readdir("dist/apps/shell", {
    withFileTypes: true,
  })) {
    if (
      !entry.isFile() ||
      entry.name === "index.html" ||
      entry.name === "404.html" ||
      entry.name.startsWith("fragment.")
    )
      continue;
    await symlink(
      resolve("dist/apps/shell", entry.name),
      join(built, entry.name),
    );
  }
  return built;
}

beforeAll(async () => {
  fixture = await createArtifactFixture([join("remotes", corruptibleRemote)]);
});

afterAll(async () => {
  for (const built of fixtures.splice(0))
    await rm(built, { recursive: true, force: true });
});

function checkArtifact(root: string = fixture) {
  return spawnSync(
    process.execPath,
    ["scripts/artifact/check-static-artifact.mjs"],
    {
      env: { ...process.env, STATIC_ARTIFACT_ROOT: root },
      encoding: "utf8",
    },
  );
}

test("the compose-time gate rejects a missing route stamp", async () => {
  const path = join(fixture, "bio/index.html");
  const original = await readFile(path, "utf8");
  await writeFile(path, original.replace('data-prerendered-route="/bio"', ""));
  const result = checkArtifact();
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain('lacks data-prerendered-route="/bio"');
  await writeFile(path, original);
});

test("the compose-time gate rejects missing inlined fragment CSS", async () => {
  const path = join(fixture, "bio/index.html");
  const original = await readFile(path, "utf8");
  await writeFile(
    path,
    original.replace(
      /<style data-prerender-remote-css="bio">[\s\S]*?<\/style>/,
      "",
    ),
  );
  const result = checkArtifact();
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain("lacks the inlined bio page CSS");
  await writeFile(path, original);
});

// Both references below are root-absolute paths carrying the Pages base, in
// documents that also carry a <base href>, so only a browser-faithful
// resolution finds them in the tree at all. The base comes from its one
// validated source rather than being restated here.
const pagesBasePrefix = new RegExp(`^${siteBase}/`);

test.each([
  [
    "stylesheet",
    "index.html",
    /<link href="([^"]+\.css)" rel="stylesheet">/,
    new RegExp(`^${siteBase}/[^/]+\\.css$`),
  ],
  [
    "script",
    `remotes/${corruptibleRemote}/index.html`,
    /<script defer src="([^"]+\.js)"><\/script>/,
    new RegExp(`^${siteBase}/remotes/${corruptibleRemote}/[^/]+$`),
  ],
])(
  "the compose-time gate rejects a document whose %s the artifact lacks",
  async (_kind, documentPath, referencePattern, expectedReference) => {
    const path = join(fixture, documentPath);
    const reference = referencePattern.exec(await readFile(path, "utf8"))?.[1];
    expect(reference).toMatch(expectedReference);
    const staged = join(fixture, reference?.replace(pagesBasePrefix, "") ?? "");
    const held = await readFile(staged);
    await rm(staged);

    const result = checkArtifact();

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(path);
    expect(result.stderr).toContain(staged);
    await writeFile(staged, held);
  },
);

// The gate names no CV content of its own, so an artifact carrying CV data that
// differs from the committed data — the most ordinary edit this repository
// takes — is still a correct artifact. The ampersand below is deliberate: React
// escapes it into the markup, so this also holds the gate to the text a visitor
// reads rather than to the bytes the document happens to spell it in.
const renamedCourse = "Valuation & Reproducible Modeling";
const renamedCourseInMarkup = "Valuation &amp; Reproducible Modeling";

function isTitledCourse(value: unknown): value is { title: string } {
  if (typeof value !== "object" || value === null || !("title" in value))
    return false;
  const { title } = value;
  return typeof title === "string" && title.length > 0;
}

/**
 * An artifact whose staged CV data renames the first course it carries.
 *
 * `carriedByDocument` says whether the composed `/courses` document was
 * rerendered from that data or left holding the title the CV data no longer
 * has, which is the difference between an artifact the gate should pass and one
 * it should refuse. Its `cv-data` is this fixture's own copy, so the rename
 * never reaches the shared build output the e2e suites serve.
 */
async function createRenamedCourseFixture(carriedByDocument: boolean) {
  const root = await createArtifactFixture(["cv-data"]);
  const coursesPath = join(root, "cv-data/domains/courses.json");
  const parsed: unknown = JSON.parse(await readFile(coursesPath, "utf8"));
  // The rename below only means anything if the file it edits really is the
  // staged courses domain, so its shape is established before an entry is read.
  const staged =
    Array.isArray(parsed) && parsed.every(isTitledCourse) ? parsed : [];
  const [committedCourse, ...rest] = staged;
  if (committedCourse === undefined)
    throw new Error(
      `${coursesPath} does not read back as a staged courses domain carrying a titled course; rebuild the artifact and rerun this spec.`,
    );
  const committed = committedCourse.title;
  const renamed = [{ ...committedCourse, title: renamedCourse }, ...rest];
  await writeFile(coursesPath, `${JSON.stringify(renamed, null, 2)}\n`);
  if (carriedByDocument) {
    const page = join(root, "courses/index.html");
    await writeFile(
      page,
      (await readFile(page, "utf8")).replaceAll(
        committed,
        renamedCourseInMarkup,
      ),
    );
  }
  return { committed, root };
}

test("the compose-time gate passes an artifact whose CV data is not the committed data", async () => {
  const { committed, root } = await createRenamedCourseFixture(true);

  const result = checkArtifact(root);

  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
  // Neither the staged data nor the document still carries the committed
  // title, so nothing in this artifact could satisfy a gate that named it.
  expect(
    await readFile(join(root, "courses/index.html"), "utf8"),
  ).not.toContain(committed);
});

test("the compose-time gate refuses a document holding a CV value the artifact dropped", async () => {
  const { root } = await createRenamedCourseFixture(false);

  const result = checkArtifact(root);

  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain(join(root, "courses/index.html"));
  expect(result.stderr).toContain(renamedCourse);
});

// `just compose <store> <output>` is the deploy lane's whole command surface,
// and its output argument becomes a write destination. Both arguments are
// rejected before compose runs, so a bad path never reaches the filesystem.
function composeCommand(store: string, output: string) {
  return spawnSync("just", ["compose", store, output], { encoding: "utf8" });
}

test("the compose command refuses a content store it cannot read", () => {
  const result = composeCommand(join(fixture, "absent"), "dist/site");

  expect(result.status).toBe(2);
  expect(result.stderr).toMatch(
    /^compose: store must be a readable content-store apps directory/,
  );
  // The deploy lane's log carries the guidance and nothing else: no shell body.
  expect(result.stderr).not.toContain("scripts/compose/compose.mjs");
  expect(result.stderr).not.toContain("FRAGMENT_ROOT=");
});

test.each([
  ["an absolute path", "/etc/site"],
  // Compose writes route documents and replaces its own `cv-data` and
  // `remotes` subtrees, so a source directory is never a legal destination.
  ["a source directory", "libs"],
])("the compose command refuses to write to %s", (_case, output) => {
  const result = composeCommand("dist/apps", output);

  expect(result.status).toBe(2);
  expect(result.stderr).toMatch(
    /^compose: output must be a workspace-relative build directory beneath dist\//,
  );
  expect(result.stderr).not.toContain(
    "scripts/artifact/check-static-artifact.mjs",
  );
});
