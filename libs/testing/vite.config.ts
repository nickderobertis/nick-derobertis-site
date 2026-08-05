import { defineWorkspaceTestConfig } from "./src/index.ts";

export default defineWorkspaceTestConfig({
  project: "testing",
  dir: "libs/testing",
  coverageInclude: ["libs/testing/src/index.ts"],
});
