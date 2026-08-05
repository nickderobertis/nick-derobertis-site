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
  },
});
