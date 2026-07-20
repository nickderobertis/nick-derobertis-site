import { defineConfig, devices } from "@playwright/test";

const port = process.env.E2E_PORT ?? "4200";
if (!/^\d{2,5}$/.test(port)) throw new Error("E2E_PORT must be a valid port");
const baseURL = `http://127.0.0.1:${port}/nick-derobertis-site/`;

export default defineConfig({
  testDir: "./src",
  testIgnore: "unit/**",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node ../../scripts/serve-e2e.mjs",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
