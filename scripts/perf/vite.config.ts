import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// The audit CLI's own specs, which drive it over Lighthouse fixtures on disk
// and need no built site. The real-browser audit is the e2e target's config.
export default defineConfig({
  root: fileURLToPath(new URL("../..", import.meta.url)),
  test: {
    include: ["scripts/perf/performance-audit.spec.ts"],
    environment: "node",
  },
});
