import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Every spec here drives a real CLI, hook, or Nx graph from the workspace root,
// so the test root is the workspace and each subprocess inherits that cwd.
export default defineConfig({
  root: fileURLToPath(new URL("../..", import.meta.url)),
  test: {
    include: [
      "scripts/artifact/check-static-artifact.spec.ts",
      "scripts/artifact/remote-manifest.spec.ts",
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
