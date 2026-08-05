import path from "node:path";
import { describe, expect, test } from "vitest";
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
    expect(config.resolve?.alias).toMatchObject({
      "@site/layout": path.resolve("libs/layout/src/index.ts"),
      "homeCards/Skeleton": path.resolve("apps/home-cards/src/skeleton.tsx"),
    });
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

  test("uses the project source tree as the default coverage boundary", () => {
    const config = defineWorkspaceTestConfig({ project: "bio", dir: "apps/bio" });
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
