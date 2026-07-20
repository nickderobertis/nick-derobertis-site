import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
export default defineConfig({
  root: fileURLToPath(new URL("../..", import.meta.url)),
  test: {
    include: ["libs/analytics/src/**/*.spec.ts"],
    environment: "jsdom",
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage/libs/analytics",
      thresholds: { lines: 95, functions: 95, branches: 95, statements: 95 },
      include: ["libs/analytics/src/**/*.ts"],
      exclude: ["libs/analytics/src/index.ts"],
    },
  },
});
