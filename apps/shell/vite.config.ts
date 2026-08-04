import { defineAppTestConfig } from "@site/testing";

export default defineAppTestConfig({
  project: "shell",
  dir: "apps/shell",
  coverageInclude: ["apps/shell/src/routes.ts"],
});
