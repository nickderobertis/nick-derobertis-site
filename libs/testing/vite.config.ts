import { defineAppTestConfig } from "./src/index.ts";

export default defineAppTestConfig({
  project: "testing",
  dir: "libs/testing",
  coverageInclude: ["libs/testing/src/index.ts"],
});
