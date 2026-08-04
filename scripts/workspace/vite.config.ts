import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Every spec here drives a real CLI, hook, or Nx graph from the workspace root,
// so the test root is the workspace and each subprocess inherits that cwd.
export default defineConfig({
  root: fileURLToPath(new URL("../..", import.meta.url)),
  test: {
    include: [
      "scripts/workspace/affected-build-projects.spec.ts",
      "scripts/workspace/federation-contract.spec.ts",
      "scripts/workspace/lint-llm-diff.spec.ts",
      "scripts/workspace/module-boundaries.spec.ts",
    ],
    environment: "node",
  },
});
