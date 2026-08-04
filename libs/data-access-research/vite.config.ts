// eslint-disable-next-line @nx/enforce-module-boundaries -- Test configuration consumes the workspace-wide shared harness; production data-domain dependencies remain unchanged.
import { defineAppTestConfig } from "@site/testing";

export default defineAppTestConfig({
  project: "data-access-research",
  dir: "libs/data-access-research",
  coverageInclude: ["libs/data-access-research/src/**/*.ts"],
});
