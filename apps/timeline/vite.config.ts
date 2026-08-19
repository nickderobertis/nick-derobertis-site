import { defineWorkspaceTestConfig } from "@site/testing";

export default defineWorkspaceTestConfig({
  project: "timeline",
  dir: "apps/timeline",
  thresholds: { lines: 95, functions: 95, branches: 95, statements: 95 },
});
