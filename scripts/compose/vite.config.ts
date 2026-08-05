import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Compose resolves every artifact path from the workspace root, so its direct
// API tests use that same root as production composition.
export default defineConfig({
  root: fileURLToPath(new URL("../..", import.meta.url)),
  test: {
    include: ["scripts/compose/compose.spec.ts"],
    environment: "node",
  },
});
