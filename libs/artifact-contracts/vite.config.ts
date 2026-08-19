import { defineWorkspaceTestConfig } from "@site/testing";

export default defineWorkspaceTestConfig({
  project: "artifact-contracts",
  dir: "libs/artifact-contracts",
  thresholds: { lines: 95, functions: 95, branches: 95, statements: 95 },
  coverageInclude: ["libs/artifact-contracts/src/**/*.ts"],
  coverageExclude: ["libs/artifact-contracts/src/index.ts"],
});
