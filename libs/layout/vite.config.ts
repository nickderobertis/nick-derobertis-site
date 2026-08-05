import { defineWorkspaceTestConfig } from "@site/testing";

export default defineWorkspaceTestConfig({
  project: "layout",
  dir: "libs/layout",
  coverageInclude: ["libs/layout/src/**/*.tsx"],
});
