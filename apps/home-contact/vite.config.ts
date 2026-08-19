import { defineWorkspaceTestConfig } from "@site/testing";

export default defineWorkspaceTestConfig({
  project: "home-contact",
  dir: "apps/home-contact",
  thresholds: { lines: 95, functions: 95, branches: 95, statements: 95 },
});
