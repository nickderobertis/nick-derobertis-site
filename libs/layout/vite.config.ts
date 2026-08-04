import { defineAppTestConfig } from "@site/testing";

export default defineAppTestConfig({
  project: "layout",
  dir: "libs/layout",
  coverageInclude: ["libs/layout/src/**/*.tsx"],
});
