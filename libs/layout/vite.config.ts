import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
export default defineConfig({
  root: fileURLToPath(new URL("../..", import.meta.url)),
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["apps/shell/src/test-setup.ts"],
    include: ["libs/layout/src/**/*.spec.tsx"],
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage/libs/layout",
      thresholds: { lines: 95, functions: 95, branches: 95, statements: 95 },
      include: ["libs/layout/src/**/*.tsx"],
    },
  },
});
