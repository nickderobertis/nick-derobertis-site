import { defineAppTestConfig } from "../testing/src/index.ts";

export default defineAppTestConfig({
  project: "route-state",
  dir: "libs/route-state",
  coverageInclude: ["libs/route-state/src/**/*.ts"],
  coverageExclude: ["libs/route-state/src/index.ts"],
});
