import { defineConfig, devices } from "@playwright/test";

const e2eBasePath = "/nick-derobertis-site";
if (!/^\/[a-z0-9-]+$/.test(e2eBasePath))
  throw new Error(
    "The e2e base path must start with / and contain only lowercase letters, digits, and hyphens; update e2eBasePath in the Playwright config",
  );
const port =
  10_000 +
  [...process.cwd()].reduce(
    (hash, character) => (hash * 31 + character.charCodeAt(0)) % 40_000,
    0,
  );
const serverUrl = `http://127.0.0.1:${port}${e2eBasePath}/`;
const isCi = process.env.CI === "1" || process.env.CI === "true";

export default defineConfig({
  testDir: "./src",
  testIgnore: "unit/**",
  use: {
    baseURL: serverUrl,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node ../../scripts/serve-e2e.mjs",
    env: {
      ...process.env,
      SITE_E2E_BASE_PATH: e2eBasePath,
      SITE_E2E_PORT: String(port),
    },
    url: serverUrl,
    reuseExistingServer: !isCi,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
