import { defineWorkspaceTestConfig } from "@site/testing";

export default defineWorkspaceTestConfig({
  project: "software",
  dir: "apps/software",
  thresholds: { lines: 95, functions: 95, branches: 95, statements: 95 },
});
