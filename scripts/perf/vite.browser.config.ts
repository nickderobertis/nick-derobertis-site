import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// The audit driven against the real served site in a real browser. It runs as
// this project's e2e target, alongside every other Playwright journey, because
// it needs the prerendered artifact those journeys are dispatched after.
export default defineConfig({
  root: fileURLToPath(new URL("../..", import.meta.url)),
  resolve: {
    alias: {
      "@site/route-state": fileURLToPath(
        new URL("../../libs/route-state/src/index.ts", import.meta.url),
      ),
      "@site/visual-harness/scenarios": fileURLToPath(
        new URL("../../libs/visual-harness/src/scenarios.ts", import.meta.url),
      ),
      "@site/visual-harness": fileURLToPath(
        new URL("../../libs/visual-harness/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    include: ["scripts/perf/performance-audit.browser.spec.ts"],
    environment: "node",
  },
});
