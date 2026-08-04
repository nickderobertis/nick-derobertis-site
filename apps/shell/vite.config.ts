import { defineAppTestConfig } from "../../libs/testing/src/index.ts";

export default defineAppTestConfig({
  project: "shell",
  dir: "apps/shell",
  coverageInclude: ["apps/shell/src/routes.ts"],
});
