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
      "scripts/workspace/lint-llm-diff.spec.ts",
      "scripts/workspace/module-boundaries.spec.ts",
      "scripts/workspace/project-manifest.spec.ts",
      "scripts/workspace/structure-contract.spec.ts",
    ],
    environment: "node",
  },
});
