import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  root: fileURLToPath(new URL("../..", import.meta.url)),
  test: {
    include: ["libs/route-state/src/**/*.spec.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage/libs/route-state",
      thresholds: { lines: 95, functions: 95, branches: 95, statements: 95 },
      include: ["libs/route-state/src/**/*.ts"],
      exclude: ["libs/route-state/src/index.ts"],
    },
  },
});
