import { defineWorkspaceTestConfig } from "@site/testing";

export default defineWorkspaceTestConfig({
  project: "courses",
  dir: "apps/courses",
  thresholds: { lines: 95, functions: 95, branches: 95, statements: 95 },
});
