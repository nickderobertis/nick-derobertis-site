import { defineWorkspaceTestConfig } from "@site/testing";

export default defineWorkspaceTestConfig({
  project: "home-story",
  dir: "apps/home-story",
  thresholds: { lines: 95, functions: 95, branches: 95, statements: 95 },
});
