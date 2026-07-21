import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
export default defineConfig({
  root: fileURLToPath(new URL("../..", import.meta.url)),
  resolve: {
    alias: {
      "@site/data-access-core": fileURLToPath(
        new URL("../data-access-core/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    include: ["libs/data-access-timeline/src/**/*.spec.ts"],
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage/libs/data-access-timeline",
      thresholds: { lines: 95, functions: 95, branches: 95, statements: 95 },
      include: ["libs/data-access-timeline/src/**/*.ts"],
    },
  },
});
