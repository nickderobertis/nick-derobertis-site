import { defineWorkspaceTestConfig } from "@site/testing";

export default defineWorkspaceTestConfig({
  project: "e2e-fixtures",
  dir: "libs/e2e-fixtures",
  thresholds: { lines: 95, functions: 95, branches: 95, statements: 95 },
  coverageInclude: ["libs/e2e-fixtures/src/**/*.ts"],
  coverageExclude: ["libs/e2e-fixtures/src/index.ts"],
});
