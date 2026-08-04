// eslint-disable-next-line @nx/enforce-module-boundaries -- Test configuration consumes the workspace-wide shared harness; production data-domain dependencies remain unchanged.
import { defineAppTestConfig } from "../testing/src/index.ts";

export default defineAppTestConfig({
  project: "data-access-home",
  dir: "libs/data-access-home",
  coverageInclude: ["libs/data-access-home/src/**/*.ts"],
  coverageExclude: ["libs/data-access-home/src/index.ts"],
});
