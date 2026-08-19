import { defineWorkspaceTestConfig } from "@site/testing";

export default defineWorkspaceTestConfig({
  project: "skills",
  dir: "apps/skills",
  thresholds: { lines: 95, functions: 95, branches: 95, statements: 95 },
});
