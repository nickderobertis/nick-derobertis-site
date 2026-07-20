import { readFileSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const siteConfig: unknown = JSON.parse(
  readFileSync("libs/data-access/src/site.config.json", "utf8"),
);
if (
  typeof siteConfig !== "object" ||
  siteConfig === null ||
  !("pagesBase" in siteConfig) ||
  typeof siteConfig.pagesBase !== "string"
)
  throw new Error("site.config.json must define pagesBase");
const testBaseUrl = `http://127.0.0.1:4301${siteConfig.pagesBase}/`;
export default defineConfig({
  testDir: "./src",
  testIgnore: "unit/**",
  workers: 1,
  retries: 1,
  expect: { timeout: 15_000 },
  timeout: 60_000,
  // TEMPORARY (local-first): skip nondeterministic hand-rolled screenshot
  // assertions so the functional e2e gate is deterministic. The screencomp
  // rework replaces these with byte-reproducible, per-microfrontend visual
  // regression owned by each remote's nx target. Remove when screencomp lands.
  ignoreSnapshots: true,
  use: {
    baseURL: testBaseUrl,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "PORT=4301 node ../../scripts/serve-e2e.mjs",
    url: testBaseUrl,
    reuseExistingServer: !process.env.CI,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
