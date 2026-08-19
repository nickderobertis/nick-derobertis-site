import { defineWorkspaceTestConfig } from "@site/testing";

export default defineWorkspaceTestConfig({
  project: "home-carousel",
  dir: "apps/home-carousel",
  thresholds: { lines: 95, functions: 95, branches: 95, statements: 95 },
});
