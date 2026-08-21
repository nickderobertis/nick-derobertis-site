import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Every spec here drives a real CLI, hook, or Nx graph from the workspace root,
// so the test root is the workspace and each subprocess inherits that cwd.
export default defineConfig({
  root: fileURLToPath(new URL("../..", import.meta.url)),
  test: {
    include: [
      "scripts/ci/ci-tools-contract.spec.ts",
      "scripts/ci/runtime-pins.spec.ts",
    ],
    environment: "node",
    // The subjects here are driven as real work from the workspace root: CLIs
    // and git hooks as real processes, Nx project and task graphs, and library
    // APIs over real artifact trees. What one of these tests costs is therefore
    // set by the workspace's size and the host's load rather than by the
    // assertion that follows it — measured from 300ms to 14s idle on one
    // machine, against Vitest's 5000ms test default and its 10_000ms hook
    // default. Both defaults sit inside the range this work genuinely occupies,
    // so both are raised for the project rather than at each site: a `beforeAll`
    // that resolves the project graph has no per-test option to carry a ceiling
    // of its own, and it is the setup every test in its file waits on. Specs
    // that already state a tighter ceiling keep it. The value is far past
    // anything the work here can cost rather than past today's contention, so
    // it still bounds a genuine hang and nothing else.
    testTimeout: 300_000,
    hookTimeout: 300_000,
  },
});
