import { readFileSync } from "node:fs";
import path from "node:path";
import {
  defineConfig,
  devices,
  type PlaywrightTestConfig,
} from "@playwright/test";

const workspaceRoot = process.cwd();

function pagesBase(): string {
  const config: unknown = JSON.parse(
    readFileSync(
      path.join(workspaceRoot, "libs/data-access-core/src/site.config.json"),
      "utf8",
    ),
  );
  return validateSiteConfig(config);
}

export function validateSiteConfig(config: unknown): string {
  if (
    typeof config !== "object" ||
    config === null ||
    !("pagesBase" in config) ||
    typeof config.pagesBase !== "string"
  )
    throw new Error("site.config.json must define pagesBase");
  return config.pagesBase;
}

export function defineAppE2eConfig(options: {
  project: string;
  port: number;
  standaloneLoadingNetworkLatencyMs?: number;
}): PlaywrightTestConfig {
  if (!/^[a-z][a-z0-9-]*$/.test(options.project))
    throw new Error("project must be a lowercase Nx project name");
  if (
    !Number.isInteger(options.port) ||
    options.port < 1 ||
    options.port > 65_535
  )
    throw new Error("port must be an integer from 1 to 65535");
  if (
    options.standaloneLoadingNetworkLatencyMs !== undefined &&
    (!Number.isInteger(options.standaloneLoadingNetworkLatencyMs) ||
      options.standaloneLoadingNetworkLatencyMs < 0)
  )
    throw new Error(
      "standaloneLoadingNetworkLatencyMs must be a non-negative integer",
    );
  const baseURL = `http://127.0.0.1:${options.port}${pagesBase()}/`;
  return defineConfig({
    metadata: {
      standaloneLoadingNetworkLatencyMs:
        options.standaloneLoadingNetworkLatencyMs ?? 0,
    },
    testDir: path.join(workspaceRoot, "apps", options.project, "e2e"),
    workers: 1,
    retries: 1,
    expect: { timeout: 15_000 },
    timeout: 60_000,
    use: { baseURL, trace: "retain-on-failure" },
    webServer: {
      command:
        "exec node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/serve/serve-e2e.mjs",
      cwd: workspaceRoot,
      env: { PORT: String(options.port) },
      url: baseURL,
      reuseExistingServer: false,
      gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
    },
    projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  });
}
