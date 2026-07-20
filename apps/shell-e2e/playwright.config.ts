import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./src",
  testIgnore: "unit/**",
  use: {
    baseURL: "http://127.0.0.1:4200/nick-derobertis-site/",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node ../../scripts/serve-e2e.mjs",
    url: "http://127.0.0.1:4200/nick-derobertis-site/",
    reuseExistingServer: !process.env.CI,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
