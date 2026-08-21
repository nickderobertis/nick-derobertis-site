import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// The audit CLI's own specs, which drive it over Lighthouse fixtures on disk
// and need no built site. The real-browser audit is the e2e target's config.
export default defineConfig({
  root: fileURLToPath(new URL("../..", import.meta.url)),
  test: {
    include: ["scripts/perf/performance-audit.spec.ts"],
    environment: "node",
    // A test here costs whatever its subject's real work costs — set by the
    // workspace's size and the host's load, not by the assertion after it:
    // 300ms to 14s idle, straddling both Vitest defaults. Hooks are raised too,
    // because a `beforeAll` takes no ceiling of its own. Far past that measured
    // range rather than just past it; a tighter ceiling at a site still wins.
    testTimeout: 300_000,
    hookTimeout: 300_000,
  },
});
