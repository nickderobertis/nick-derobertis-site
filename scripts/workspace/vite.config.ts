import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// These workspace contracts resolve repository files and subprocess paths from
// the workspace root, matching the contributor commands they verify.
export default defineConfig({
  root: fileURLToPath(new URL("../..", import.meta.url)),
  test: {
    include: [
      "scripts/workspace/affected-build-projects.spec.ts",
      "scripts/workspace/cache-keying.spec.ts",
      "scripts/workspace/federation-contract.spec.ts",
      "scripts/workspace/federation-registry.spec.ts",
      "scripts/workspace/gate-browser-lanes.spec.ts",
      "scripts/workspace/lint-llm-diff.spec.ts",
      "scripts/workspace/llmlint-cache.spec.ts",
      "scripts/workspace/module-boundaries.spec.ts",
      "scripts/workspace/project-manifest.spec.ts",
      "scripts/workspace/structure-contract.spec.ts",
    ],
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
