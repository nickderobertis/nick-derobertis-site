import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// The audit driven against the real served site in a real browser. It runs as
// this project's e2e target, alongside every other Playwright journey, because
// it needs the prerendered artifact those journeys are dispatched after.
export default defineConfig({
  root: fileURLToPath(new URL("../..", import.meta.url)),
  test: {
    include: ["scripts/perf/performance-audit.browser.spec.ts"],
    environment: "node",
  },
});
