import { describe, expect, test } from "vitest";
import { remoteRegistry, validatedRemoteRegistry } from "./remote-registry";

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
});
