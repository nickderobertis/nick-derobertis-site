import { spawnSync } from "node:child_process";
import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { remoteRegistry, validatedRemoteRegistry } from "./remote-registry";

// The two tests below each drive the registry loader as a real process, whose
// cost is a Node runtime starting and type-stripping its way to the module —
// host-bound, and past Vitest's 5000ms default once `nx affected --parallel=3`
// contends for the CPU. Far past that rather than just past it, so it still
// bounds a genuine hang.
const realProcessCeiling = { timeout: 300_000 };

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

/**
 * Copies this module beside a registry of the caller's choosing and imports it
 * the way every consumer does — a real Node process type-stripping the real
 * file — so the guard is observed where it actually runs, at import, rather
 * than only as a function call inside this test process.
 */
async function importWithRegistry(registry: string) {
  const root = await mkdtemp(join(tmpdir(), "remote-registry-"));
  roots.push(root);
  await cp(
    "libs/build-config/src/remote-registry.ts",
    join(root, "remote-registry.ts"),
  );
  await writeFile(join(root, "remotes.json"), registry);
  const probe = join(root, "probe.ts");
  await writeFile(probe, 'import "./remote-registry.ts";\n');
  return spawnSync(
    process.execPath,
    ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", probe],
    { encoding: "utf8" },
  );
}

// remotes.json is the one place a remote's project name and its federation
// alias are written down, and three things downstream read it as trusted input:
// rspack builds a remote entry from the alias, the Home fragment frame names a
// pane by project name, and a publish lane turns that project name into a
// subtree path on the content-store branch. So the grammar is checked here,
// once, rather than restated by each consumer.
describe("the canonical remote registry", () => {
  test.each([
    ["is missing", undefined],
    ["is null", null],
    ["is an array rather than a mapping", ["awards"]],
    ["is empty, so it defines no remote at all", {}],
    [
      "names a remote that could not be a subtree path",
      { "../escape": "escape" },
    ],
    ["names a remote that could not be an Nx project", { Awards: "awards" }],
    ["maps a remote to a non-string alias", { awards: 7 }],
    [
      "maps a remote to an alias that could not be a federation container",
      { awards: "awards-container" },
    ],
  ])("a registry that %s is refused", (_case, registry) => {
    expect(() => validatedRemoteRegistry(registry)).toThrow(
      /must map every remote's project name to a federation alias string/,
    );
  });

  test("accepts a registry whose names and aliases are both well formed", () => {
    const registry = { "home-cards": "homeCards" };

    expect(validatedRemoteRegistry(registry)).toEqual(registry);
  });

  test("narrows the committed registry every consumer reads", () => {
    expect(validatedRemoteRegistry(remoteRegistry)).toEqual(remoteRegistry);
    expect(Object.keys(remoteRegistry)).toContain("home");
  });

  // A registry with no remotes is the one malformed shape that still parses as
  // a mapping, so nothing downstream would throw on it: rspack would build a
  // shell federating nothing, the Home frame would publish slots no pane can
  // fill, and the publish matrix would quietly shrink to the shell alone. There
  // is no browser state to drive for it — with no remote declared, neither a
  // standalone remote document nor a host-composed pane exists to render — so
  // the failure is observed where it happens, in a real process loading the
  // real module against a real registry file.
  test(
    "a real process refuses to load a registry that declares no remote",
    realProcessCeiling,
    async () => {
      const result = await importWithRegistry("{}\n");

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain(
        "must map every remote's project name to a federation alias string",
      );
    },
  );

  test(
    "a real process loads a registry that declares a well formed remote",
    realProcessCeiling,
    async () => {
      const result = await importWithRegistry(
        '{ "home-cards": "homeCards" }\n',
      );

      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");
    },
  );
});
