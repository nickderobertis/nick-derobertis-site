import { defineAppTestConfig } from "../testing/src/index.ts";

export default defineAppTestConfig({
  project: "layout",
  dir: "libs/layout",
  coverageInclude: ["libs/layout/src/**/*.tsx"],
});
