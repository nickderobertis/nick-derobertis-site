import { spawnSync } from "node:child_process";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, expect, test } from "vitest";

let fixture: string;

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
  await symlink(resolve("dist/apps/shell/remotes"), join(fixture, "remotes"));
  await symlink(resolve("dist/apps/shell/cv-data"), join(fixture, "cv-data"));
});

afterAll(async () => {
  await rm(fixture, { recursive: true, force: true });
});

function checkArtifact() {
  return spawnSync(process.execPath, ["scripts/check-static-artifact.mjs"], {
    env: { ...process.env, STATIC_ARTIFACT_ROOT: fixture },
    encoding: "utf8",
  });
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
