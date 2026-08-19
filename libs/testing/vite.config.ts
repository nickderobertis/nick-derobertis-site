import { defineWorkspaceTestConfig } from "./src/index.ts";

export default defineWorkspaceTestConfig({
  project: "testing",
  dir: "libs/testing",
  thresholds: { lines: 95, functions: 95, branches: 95, statements: 95 },
  coverageInclude: ["libs/testing/src/index.ts"],
});
