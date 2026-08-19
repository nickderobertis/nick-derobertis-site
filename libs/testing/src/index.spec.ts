import path from "node:path";
import { describe, expect, test } from "vitest";
import { defineWorkspaceTestConfig } from "./index.ts";

const floor = { lines: 95, functions: 95, branches: 95, statements: 95 };

describe("defineWorkspaceTestConfig", () => {
  test("builds the fixed component-test contract and merges remote aliases", () => {
    const config = defineWorkspaceTestConfig({
      project: "awards",
      dir: "apps/awards",
      thresholds: floor,
      remotes: { "homeCards/Skeleton": "apps/home-cards/src/skeleton.tsx" },
      coverageInclude: ["apps/awards/src/page.tsx"],
      coverageExclude: ["apps/awards/src/index.ts"],
    });

    expect(config.root).toBe(path.resolve(import.meta.dirname, "../../.."));
    expect(config.resolve?.alias).toEqual({
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
        thresholds: floor,
      },
    });
  });

  test("carries the floor the calling project declares, not a fixed one", () => {
    const config = defineWorkspaceTestConfig({
      project: "bio",
      dir: "apps/bio",
      thresholds: { lines: 80, functions: 70, branches: 60, statements: 50 },
    });
    expect(config.test?.coverage?.thresholds).toEqual({
      lines: 80,
      functions: 70,
      branches: 60,
      statements: 50,
    });
  });

  test("uses the project source tree as the default coverage boundary and composes no remote", () => {
    const config = defineWorkspaceTestConfig({
      project: "bio",
      dir: "apps/bio",
      thresholds: floor,
    });
    expect(config.test?.coverage?.include).toEqual([
      "apps/bio/src/**/*.{ts,tsx}",
    ]);
    expect(config.test?.coverage?.exclude).toBeUndefined();
    expect(config.resolve?.alias).toEqual({});
  });

  test.each([
    [
      "an invalid project name",
      { project: "Bad_Name", dir: "apps/bio", thresholds: floor },
      "at project",
    ],
    [
      "a floor outside the range coverage reports",
      {
        project: "bio",
        dir: "apps/bio",
        thresholds: { ...floor, branches: 195 },
      },
      "at thresholds.branches",
    ],
    [
      "a metric the floor leaves unstated",
      {
        project: "bio",
        dir: "apps/bio",
        thresholds: { lines: 95, functions: 95, branches: 95 },
      },
      "at thresholds.statements",
    ],
    [
      "an option this harness does not define",
      {
        project: "bio",
        dir: "apps/bio",
        thresholds: floor,
        coverageInclud: ["apps/bio/src/page.tsx"],
      },
      'Unrecognized key: "coverageInclud"',
    ],
  ])("refuses %s at the configuration boundary", (_, options, reported) => {
    expect(() =>
      defineWorkspaceTestConfig(
        options as Parameters<typeof defineWorkspaceTestConfig>[0],
      ),
    ).toThrow(
      expect.objectContaining({
        message: expect.stringContaining(reported) as unknown as string,
      }),
    );
  });
});
