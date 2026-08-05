import { defineWorkspaceTestConfig } from "@site/testing";

export default defineWorkspaceTestConfig({
  project: "visual-harness",
  dir: "libs/visual-harness",
  coverageInclude: ["libs/visual-harness/src/scenarios.ts"],
});
