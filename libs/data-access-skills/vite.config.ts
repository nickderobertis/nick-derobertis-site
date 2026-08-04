// eslint-disable-next-line @nx/enforce-module-boundaries -- Test configuration consumes the workspace-wide shared harness; production data-domain dependencies remain unchanged.
import { defineAppTestConfig } from "@site/testing";

export default defineAppTestConfig({
  project: "data-access-skills",
  dir: "libs/data-access-skills",
  coverageInclude: ["libs/data-access-skills/src/**/*.ts"],
  coverageExclude: ["libs/data-access-skills/src/index.ts"],
});
