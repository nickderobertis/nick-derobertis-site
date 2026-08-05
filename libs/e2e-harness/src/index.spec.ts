import path from "node:path";
import { expect, test } from "vitest";
import { defineAppE2eConfig, validateSiteConfig } from "./config.ts";

test("defines the shared app Playwright contract", () => {
  const config = defineAppE2eConfig({ project: "awards", port: 4321 });
  expect(config).toMatchObject({
    testDir: expect.stringContaining(path.join("apps", "awards", "e2e")),
    workers: 1,
    retries: 1,
    expect: { timeout: 15_000 },
    timeout: 60_000,
    use: {
      baseURL: "http://127.0.0.1:4321/nick-derobertis-site/",
      trace: "retain-on-failure",
    },
    webServer: {
      env: { PORT: "4321" },
      url: "http://127.0.0.1:4321/nick-derobertis-site/",
      reuseExistingServer: false,
    },
  });
  expect(config.projects).toHaveLength(1);
  expect(config.projects?.[0]?.name).toBe("chromium");
});

test.each([
  [{ project: "../shell", port: 4301 }, "project"],
  [{ project: "shell", port: 0 }, "port"],
  [{ project: "shell", port: 65_536 }, "port"],
])("rejects invalid app config %j", (options, message) => {
  expect(() => defineAppE2eConfig(options)).toThrow(message);
});

test.each([undefined, null, [], {}, { pagesBase: 1 }])(
  "rejects a malformed site config %j",
  (config) => {
    expect(() => validateSiteConfig(config)).toThrow(
      "site.config.json must define pagesBase",
    );
  },
);
