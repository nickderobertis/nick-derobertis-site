import { defineWorkspaceTestConfig } from "@site/testing";

export default defineWorkspaceTestConfig({
  project: "home-cards",
  dir: "apps/home-cards",
  thresholds: { lines: 95, functions: 95, branches: 95, statements: 95 },
});
