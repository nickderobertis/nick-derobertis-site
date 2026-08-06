// eslint-disable-next-line @nx/enforce-module-boundaries -- Test configuration consumes the workspace-wide shared harness; production contract dependencies remain unchanged.
import { defineWorkspaceTestConfig } from "@site/testing";

export default defineWorkspaceTestConfig({
  project: "artifact-contracts",
  dir: "libs/artifact-contracts",
  coverageInclude: ["libs/artifact-contracts/src/**/*.ts"],
  coverageExclude: ["libs/artifact-contracts/src/index.ts"],
});
