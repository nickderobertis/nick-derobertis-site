import path from "node:path";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { defineWorkspaceTestConfig, resolveTsconfigAliases } from "./index.ts";

describe("defineWorkspaceTestConfig", () => {
  test("builds the fixed component-test contract and merges remote aliases", () => {
    const config = defineWorkspaceTestConfig({
      project: "awards",
      dir: "apps/awards",
      remotes: { "homeCards/Skeleton": "apps/home-cards/src/skeleton.tsx" },
      coverageInclude: ["apps/awards/src/page.tsx"],
      coverageExclude: ["apps/awards/src/index.ts"],
    });

    expect(config.root).toBe(path.resolve(import.meta.dirname, "../../.."));
    expect(config.resolve?.alias).toEqual(
      expect.arrayContaining([
        {
          find: /^@site\/layout$/,
          replacement: path.resolve("libs/layout/src/index.ts"),
        },
        {
          find: "homeCards/Skeleton",
          replacement: path.resolve("apps/home-cards/src/skeleton.tsx"),
        },
      ]),
    );
    expect(config.test).toMatchObject({
      environment: "jsdom",
      setupFiles: ["libs/testing/src/setup.ts"],
      include: ["apps/awards/src/**/*.spec.{ts,tsx}"],
      coverage: {
        reportsDirectory: "coverage/apps/awards",
        include: ["apps/awards/src/page.tsx"],
        exclude: ["apps/awards/src/index.ts"],
        thresholds: { lines: 95, functions: 95, branches: 95, statements: 95 },
      },
    });
  });

  // Vite tests a string alias against every subpath beneath it, so an
  // unanchored mapping would rewrite `@site/layout/contracts.json` onto
  // `.../index.tscontracts.json`. Each library declares its own subpaths as
  // exports, and this is what leaves them to resolve there.
  test("leaves a library's subpaths to the exports that library declares", () => {
    const config = defineWorkspaceTestConfig({
      project: "awards",
      dir: "apps/awards",
    });
    const layout = z
      .array(
        z.object({
          find: z.union([z.string(), z.instanceof(RegExp)]),
          replacement: z.string(),
        }),
      )
      .parse(config.resolve?.alias)
      .find(
        ({ replacement }) =>
          replacement === path.resolve("libs/layout/src/index.ts"),
      )?.find;
    expect(layout).toBeInstanceOf(RegExp);
    // Vite tests a RegExp alias against the whole specifier, so these two
    // answers are the ones it gives the imports below. The schema above types
    // `layout` as `string | RegExp | undefined` because Vite accepts either
    // kind of `find`, and `toBeInstanceOf` is a runtime matcher rather than a
    // type predicate, so it narrows nothing for the compiler. The casts stand
    // on the assertion immediately above them, which fails first — and names
    // what it got — if this alias is ever not a RegExp.
    expect((layout as RegExp).test("@site/layout")).toBe(true);
    expect((layout as RegExp).test("@site/layout/contracts.json")).toBe(false);
  });

  test("uses the project source tree as the default coverage boundary", () => {
    const config = defineWorkspaceTestConfig({
      project: "bio",
      dir: "apps/bio",
    });
    expect(config.test?.coverage?.include).toEqual([
      "apps/bio/src/**/*.{ts,tsx}",
    ]);
  });

  test("rejects invalid project names at the configuration boundary", () => {
    expect(() =>
      defineWorkspaceTestConfig({ project: "Bad_Name", dir: "apps/bio" }),
    ).toThrow("Invalid test project name");
  });

  test("rejects malformed tsconfig path mappings at the configuration boundary", () => {
    expect(() =>
      resolveTsconfigAliases("/workspace", {
        compilerOptions: { paths: { "@site/broken": [] } },
      }),
    ).toThrow();
  });
});
