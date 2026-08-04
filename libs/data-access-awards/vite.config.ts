// eslint-disable-next-line @nx/enforce-module-boundaries -- Test configuration consumes the workspace-wide shared harness; production data-domain dependencies remain unchanged.
import { defineAppTestConfig } from "../testing/src/index.ts";

export default defineAppTestConfig({
  project: "data-access-awards",
  dir: "libs/data-access-awards",
  coverageInclude: ["libs/data-access-awards/src/**/*.ts"],
  coverageExclude: ["libs/data-access-awards/src/index.ts"],
});
