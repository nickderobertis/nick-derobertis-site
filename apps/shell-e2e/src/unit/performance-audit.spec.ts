import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const workspace = path.resolve(import.meta.dirname, "../../../..");
const script = path.join(workspace, "scripts/performance-audit.mjs");
const temporaryDirectories: string[] = [];

function fixture(value: number) {
  return {
    lighthouseVersion: "12.8.2",
    userAgent: "fixture Chromium",
    configSettings: {
      formFactor: "desktop",
      throttlingMethod: "simulate",
      throttling: { cpuSlowdownMultiplier: 1, rttMs: 40 },
    },
    categories: { performance: { score: value / 100 } },
    audits: {
      "first-contentful-paint": { numericValue: value * 10 },
      "largest-contentful-paint": { numericValue: value * 20 },
      "total-blocking-time": { numericValue: value * 2 },
      "cumulative-layout-shift": { numericValue: value / 1000 },
      "total-byte-weight": { numericValue: value * 1024 },
      "resource-summary": {
        details: {
          items: [{ resourceType: "script", transferSize: value * 512 }],
        },
      },
    },
  };
}

function createFixtureDirectory(runs = 5) {
  const directory = execFileSync(
    "mktemp",
    ["-d", path.join(tmpdir(), "perf-audit.XXXXXX")],
    { encoding: "utf8" },
  ).trim();
  temporaryDirectories.push(directory);
  const routes = ["home", "bio", "research", "software", "courses"];
  for (const [site, offset] of [
    ["new", 10],
    ["original", 20],
  ] as const) {
    for (const route of routes) {
      for (let run = 1; run <= runs; run += 1) {
        writeFileSync(
          path.join(directory, `${site}-${route}-${run}.json`),
          JSON.stringify(fixture(offset + run)),
        );
      }
    }
  }
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    execFileSync("rm", ["-rf", directory]);
  }
});

describe("performance audit CLI", () => {
  it("writes median side-by-side findings and a readable delta report", () => {
    const directory = createFixtureDirectory();
    const output = execFileSync(
      process.execPath,
      [script, "--summarize-fixtures", directory],
      { cwd: directory, encoding: "utf8" },
    );
    const findings = JSON.parse(output);
    const report = readFileSync(
      path.join(directory, "docs/perf-report.md"),
      "utf8",
    );

    expect(findings.runsPerRoute).toBe(5);
    expect(findings.sites.new.routes["/"].fcp).toBe(130);
    expect(findings.sites.original.routes["/"].fcp).toBe(230);
    expect(report).toContain("| FCP | 130 ms | 230 ms | -100 ms |");
    expect(report).toContain(
      "Absolute CPU- and network-bound timings are host-dependent",
    );
    expect(report).toContain("cpuSlowdownMultiplier");
  });

  it("fails clearly when a route has fewer than five runs", () => {
    const directory = createFixtureDirectory(4);
    const result = spawnSync(
      process.execPath,
      [script, "--summarize-fixtures", directory],
      { cwd: directory, encoding: "utf8" },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("at least 5 are required");
  });
});
