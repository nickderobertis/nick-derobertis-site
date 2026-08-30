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
import { siteBase } from "@site/data-access-core/site";
import { afterAll, beforeAll, expect, test } from "vitest";

let fixture: string;
const corruptibleRemote = "bio";

beforeAll(async () => {
  fixture = await mkdtemp(join(tmpdir(), "static-artifact-"));
  for (const route of ["", "bio", "research", "software", "courses"]) {
    const destination = join(fixture, route);
    await mkdir(destination, { recursive: true });
    await cp(
      join("dist/apps/shell", route, "index.html"),
      join(destination, "index.html"),
    );
  }
  await cp("dist/apps/shell/404.html", join(fixture, "404.html"));
  await symlink(resolve("dist/apps/shell/cv-data"), join(fixture, "cv-data"));
  // Every remote is linked rather than copied, except the one a test below
  // corrupts: that subtree has to be the fixture's own bytes so removing an
  // asset from it never reaches the shared build output.
  await mkdir(join(fixture, "remotes"), { recursive: true });
  for (const name of await readdir("dist/apps/shell/remotes")) {
    const source = resolve("dist/apps/shell/remotes", name);
    const destination = join(fixture, "remotes", name);
    if (name === corruptibleRemote)
      await cp(source, destination, { recursive: true });
    else await symlink(source, destination);
  }
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
      join(fixture, entry.name),
    );
  }
});

afterAll(async () => {
  await rm(fixture, { recursive: true, force: true });
});

function checkArtifact() {
  return spawnSync(
    process.execPath,
    ["scripts/artifact/check-static-artifact.mjs"],
    {
      env: { ...process.env, STATIC_ARTIFACT_ROOT: fixture },
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
