import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
export default defineConfig({
  root: fileURLToPath(new URL("../..", import.meta.url)),
  test: {
    include: ["libs/data-access/src/**/*.spec.ts"],
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage/libs/data-access",
      thresholds: { lines: 95, functions: 95, branches: 95, statements: 95 },
      include: ["libs/data-access/src/**/*.ts"],
      exclude: ["libs/data-access/src/index.ts"],
    },
  },
});
