import { defineWorkspaceTestConfig } from "@site/testing";

export default defineWorkspaceTestConfig({
  project: "publish-config",
  dir: "libs/publish-config",
  // This project's one spec drives the publish lane, whose work is real git
  // against a real repository — a host-bound cost, not an assertion-bound one.
  // That is the project rather than a few of its tests, so the ceiling is
  // stated once here, far past what those spawns cost so it still bounds a
  // genuine hang.
  testTimeout: 300_000,
  thresholds: { lines: 95, functions: 95, branches: 95, statements: 95 },
  coverageInclude: ["libs/publish-config/src/**/*.{ts,tsx}"],
  coverageExclude: ["libs/publish-config/src/index.ts"],
});
