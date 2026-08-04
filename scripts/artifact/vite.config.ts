import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Every spec here drives a real CLI, hook, or Nx graph from the workspace root,
// so the test root is the workspace and each subprocess inherits that cwd.
export default defineConfig({
  root: fileURLToPath(new URL("../..", import.meta.url)),
  // check-static-artifact.spec.ts reads the one validated Pages base rather
  // than restating it, and reads it across a project boundary the same way
  // application code does.
  resolve: {
    alias: {
      "@site/data-access-core": fileURLToPath(
        new URL("../../libs/data-access-core/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    include: [
      "scripts/artifact/check-static-artifact.spec.ts",
      "scripts/artifact/remote-manifest.spec.ts",
    ],
    environment: "node",
  },
});
