import { defineAppTestConfig } from "@site/testing";

export default defineAppTestConfig({
  project: "visual-harness",
  dir: "libs/visual-harness",
  coverageInclude: ["libs/visual-harness/src/scenarios.ts"],
});
