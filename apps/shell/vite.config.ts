import { defineWorkspaceTestConfig } from "@site/testing";

export default defineWorkspaceTestConfig({
  project: "shell",
  dir: "apps/shell",
  coverageInclude: ["apps/shell/src/routes.ts"],
});
