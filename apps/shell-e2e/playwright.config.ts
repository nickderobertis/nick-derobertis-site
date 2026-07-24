import { readFileSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const siteConfig: unknown = JSON.parse(
  readFileSync("libs/data-access-core/src/site.config.json", "utf8"),
);
if (
  typeof siteConfig !== "object" ||
  siteConfig === null ||
  !("pagesBase" in siteConfig) ||
  typeof siteConfig.pagesBase !== "string"
)
  throw new Error("site.config.json must define pagesBase");
const port = process.env.E2E_PORT ?? "4301";
if (!/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65_535)
  throw new Error("E2E_PORT must be an integer from 1 to 65535");
const testBaseUrl = `http://127.0.0.1:${port}${siteConfig.pagesBase}/`;
export default defineConfig({
  testDir: "./src",
  testIgnore: "unit/**",
  workers: 1,
  retries: 1,
  expect: { timeout: 15_000 },
  timeout: 60_000,
  use: {
    baseURL: testBaseUrl,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "exec node ../../scripts/serve-e2e.mjs",
    env: { PORT: port },
    url: testBaseUrl,
    reuseExistingServer: false,
    gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
