import { defineWorkspaceTestConfig } from "@site/testing";

export default defineWorkspaceTestConfig({
  project: "publish-config",
  dir: "libs/publish-config",
  thresholds: { lines: 95, functions: 95, branches: 95, statements: 95 },
  coverageInclude: ["libs/publish-config/src/**/*.{ts,tsx}"],
  coverageExclude: ["libs/publish-config/src/index.ts"],
});
