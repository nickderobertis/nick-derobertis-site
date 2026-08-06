// eslint-disable-next-line @nx/enforce-module-boundaries -- Test configuration consumes the workspace-wide shared harness; production fixture dependencies remain unchanged.
import { defineWorkspaceTestConfig } from "@site/testing";

export default defineWorkspaceTestConfig({
  project: "e2e-fixtures",
  dir: "libs/e2e-fixtures",
  coverageInclude: ["libs/e2e-fixtures/src/**/*.ts"],
  coverageExclude: ["libs/e2e-fixtures/src/index.ts"],
});
