// eslint-disable-next-line @nx/enforce-module-boundaries -- Test configuration consumes the workspace-wide shared harness; production data-core dependencies remain unchanged.
import { defineAppTestConfig } from "../testing/src/index.ts";

export default defineAppTestConfig({
  project: "data-access-core",
  dir: "libs/data-access-core",
  coverageInclude: ["libs/data-access-core/src/**/*.ts"],
  coverageExclude: ["libs/data-access-core/src/index.ts"],
});
