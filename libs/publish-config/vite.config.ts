import { defineWorkspaceTestConfig } from "@site/testing";

export default defineWorkspaceTestConfig({
  project: "publish-config",
  dir: "libs/publish-config",
  // This project's one spec drives the publish lane, and a lane's work is git:
  // every test that reaches the content store spawns real processes against a
  // real repository, at a cost set by the host rather than by the assertion
  // that follows. The subject is the whole project rather than a few of its
  // tests, so the ceiling is stated once here. It is set far past anything
  // those spawns can cost rather than past today's contention, so it still
  // bounds a genuine hang.
  testTimeout: 300_000,
  thresholds: { lines: 95, functions: 95, branches: 95, statements: 95 },
  coverageInclude: ["libs/publish-config/src/**/*.{ts,tsx}"],
  coverageExclude: ["libs/publish-config/src/index.ts"],
});
