import path from "node:path";
import { runnerImport } from "vite";
import { describe, expect, test } from "vitest";
import { defineWorkspaceTestConfig } from "./index.ts";

const floor = { lines: 95, functions: 95, branches: 95, statements: 95 };

/**
 * Four mappings that overlap in both ways a specifier can be claimed by more
 * than one of them: `panes/card/list` lies beneath `panes/card`, which is the
 * shape a subpath module of a workspace library takes, and `skeletons/card`
 * lies inside the `skeletons/*` family. Each stand-in reports the specifier
 * that should reach it, so a mapping resolving to the wrong module fails on
 * the name it reported rather than on a file that happens not to exist.
 */
const mappings: Record<string, string> = {
  "panes/card": "libs/testing/test-remotes/card.ts",
  "panes/card/list": "libs/testing/test-remotes/card-list.ts",
  "skeletons/*": "libs/testing/test-remotes/skeletons/*",
  "skeletons/card": "libs/testing/test-remotes/card-skeleton.ts",
};

const reversed = Object.fromEntries(Object.entries(mappings).reverse());

const config = (remotes: Record<string, string>) =>
  defineWorkspaceTestConfig({
    project: "testing",
    dir: "libs/testing",
    thresholds: floor,
    remotes,
  });

/**
 * Vite is asked to import a module for real through the configuration the
 * harness produced, so what is under test is the resolution a spec in any
 * project gets rather than the alias entries this file could have read back
 * out of the config object.
 */
async function importThrough(entry: string, remotes: Record<string, string>) {
  const { module } = await runnerImport<
    typeof import("../test-remotes/importer.ts")
  >(entry, config(remotes));
  return module;
}

const importer = path.resolve("libs/testing/test-remotes/importer.ts");

// Each case starts a Vite server and evaluates the module graph behind it,
// which the runner's 5000ms default does not bound on a loaded host. The rest
// of this project's tests keep that default as their hang detector.
const evaluatesAModuleGraph = 120_000;

describe("resolving the specifiers a component config maps", () => {
  test.each([
    ["written shortest first", mappings],
    ["written longest first", reversed],
  ])(
    "carries every specifier to its own target, %s",
    async (_, remotes) => {
      await expect(importThrough(importer, remotes)).resolves.toMatchObject({
        resolutions: {
          card: "panes/card",
          cardList: "panes/card/list",
          skeletonCard: "skeletons/card",
          skeletonTimeline: "skeletons/timeline",
        },
      });
    },
    evaluatesAModuleGraph,
  );

  test(
    "claims nothing beyond the specifiers it maps",
    async () => {
      // `panes/card` is mapped and `panes/card/detail` is not. A prefix-matched
      // alias would have answered for it anyway, pointing at a path inside the
      // file `panes/card` resolves to; an anchored one leaves it unresolved,
      // which is what a missing mapping should look like.
      await expect(
        importThrough("panes/card/detail", mappings),
      ).rejects.toThrow(/panes\/card\/detail/);
    },
    evaluatesAModuleGraph,
  );
});
