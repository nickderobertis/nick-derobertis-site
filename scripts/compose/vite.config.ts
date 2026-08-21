import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Compose resolves every artifact path from the workspace root, so its direct
// API tests use that same root as production composition.
export default defineConfig({
  root: fileURLToPath(new URL("../..", import.meta.url)),
  test: {
    include: ["scripts/compose/compose.spec.ts"],
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
