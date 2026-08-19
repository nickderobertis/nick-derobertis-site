// eslint-disable-next-line @nx/enforce-module-boundaries -- Test configuration consumes the workspace-wide shared harness; production data-domain dependencies remain unchanged.
import { defineWorkspaceTestConfig } from "@site/testing";

export default defineWorkspaceTestConfig({
  project: "data-access-awards",
  dir: "libs/data-access-awards",
  thresholds: { lines: 95, functions: 95, branches: 95, statements: 95 },
  coverageInclude: ["libs/data-access-awards/src/**/*.ts"],
  coverageExclude: ["libs/data-access-awards/src/index.ts"],
});
