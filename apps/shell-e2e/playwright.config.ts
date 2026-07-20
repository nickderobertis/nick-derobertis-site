import { defineConfig, devices } from "@playwright/test";

const e2ePort = 4373;
export default defineConfig({
  testDir: "./src",
  testIgnore: "unit/**",
  use: {
    baseURL: `http://127.0.0.1:${e2ePort}/nick-derobertis-site/`,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `SITE_E2E_PORT=${e2ePort} node ../../scripts/serve-e2e.mjs`,
    url: `http://127.0.0.1:${e2ePort}/nick-derobertis-site/`,
    reuseExistingServer: false,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
