import { defineWorkspaceTestConfig } from "@site/testing";

export default defineWorkspaceTestConfig({
  project: "publish-config",
  dir: "libs/publish-config",
  coverageInclude: ["libs/publish-config/src/**/*.{ts,tsx}"],
  coverageExclude: ["libs/publish-config/src/index.ts"],
});
