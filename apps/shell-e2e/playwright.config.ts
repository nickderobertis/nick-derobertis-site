import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./src",
  testIgnore: "unit/**",
  expect: { timeout: 15_000 },
  timeout: 60_000,
  use: {
    baseURL: "http://127.0.0.1:4301/nick-derobertis-site/",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "PORT=4301 node ../../scripts/serve-e2e.mjs",
    url: "http://127.0.0.1:4301/nick-derobertis-site/",
    reuseExistingServer: !process.env.CI,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
