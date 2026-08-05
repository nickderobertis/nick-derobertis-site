import { defineWorkspaceTestConfig } from "@site/testing";

export default defineWorkspaceTestConfig({
  project: "e2e-harness",
  dir: "libs/e2e-harness",
  coverageInclude: ["libs/e2e-harness/src/config.ts"],
});
