// eslint-disable-next-line @nx/enforce-module-boundaries -- Test configuration consumes the workspace-wide shared harness; production data-core dependencies remain unchanged.
import { defineWorkspaceTestConfig } from "@site/testing";

export default defineWorkspaceTestConfig({
  project: "data-access-core",
  dir: "libs/data-access-core",
  thresholds: { lines: 95, functions: 95, branches: 95, statements: 95 },
  coverageInclude: ["libs/data-access-core/src/**/*.ts"],
  coverageExclude: ["libs/data-access-core/src/index.ts"],
});
