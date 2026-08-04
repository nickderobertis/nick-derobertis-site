// eslint-disable-next-line @nx/enforce-module-boundaries -- Test configuration consumes the workspace-wide shared harness; production data-domain dependencies remain unchanged.
import { defineAppTestConfig } from "@site/testing";

export default defineAppTestConfig({
  project: "data-access-software",
  dir: "libs/data-access-software",
  coverageInclude: ["libs/data-access-software/src/**/*.ts"],
});
