import { defineWorkspaceTestConfig } from "@site/testing";

export default defineWorkspaceTestConfig({
  project: "awards",
  dir: "apps/awards",
  thresholds: { lines: 95, functions: 95, branches: 95, statements: 95 },
});
