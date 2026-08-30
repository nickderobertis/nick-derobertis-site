import { defineWorkspaceTestConfig } from "@site/testing";

export default defineWorkspaceTestConfig({
  project: "design-system",
  dir: "libs/design-system",
  thresholds: { lines: 95, functions: 95, branches: 95, statements: 95 },
});
