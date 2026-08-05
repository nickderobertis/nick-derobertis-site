// eslint-disable-next-line @nx/enforce-module-boundaries -- Test configuration consumes the workspace-wide shared harness; production data-domain dependencies remain unchanged.
import { defineWorkspaceTestConfig } from "@site/testing";

export default defineWorkspaceTestConfig({
  project: "data-access-courses",
  dir: "libs/data-access-courses",
  coverageInclude: ["libs/data-access-courses/src/**/*.ts"],
});
