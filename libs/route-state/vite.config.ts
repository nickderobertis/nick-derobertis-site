import { defineWorkspaceTestConfig } from "@site/testing";

export default defineWorkspaceTestConfig({
  project: "route-state",
  dir: "libs/route-state",
  thresholds: { lines: 95, functions: 95, branches: 95, statements: 95 },
  coverageInclude: ["libs/route-state/src/**/*.ts"],
  coverageExclude: ["libs/route-state/src/index.ts"],
});
