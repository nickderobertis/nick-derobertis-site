import { defineConfig, devices } from "@playwright/test";

const port = process.env.E2E_PORT ?? "4200";
const portNumber = Number(port);
if (!Number.isInteger(portNumber) || portNumber < 1024 || portNumber > 65_535)
  throw new Error(
    "Set E2E_PORT to an available numeric port from 1024 to 65535",
  );
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
