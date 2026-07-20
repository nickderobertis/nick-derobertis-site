import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
export default defineConfig({
  root: fileURLToPath(new URL("../..", import.meta.url)),
  plugins: [react()],
  test: {
    include: ["apps/shell/src/**/*.spec.ts"],
    environment: "jsdom",
    setupFiles: ["apps/shell/src/test-setup.ts"],
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage/apps/shell",
      thresholds: { lines: 95, functions: 95, branches: 95, statements: 95 },
      include: ["apps/shell/src/routes.ts"],
    },
  },
});
