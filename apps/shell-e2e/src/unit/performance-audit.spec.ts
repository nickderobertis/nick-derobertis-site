import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";

const workspace = path.resolve(import.meta.dirname, "../../../..");
const script = path.join(workspace, "scripts/performance-audit.mjs");
const performanceConfigSchema = z.object({
  routes: z.array(z.string()).min(1),
  minimumRuns: z.number().int().positive(),
  newUrl: z.string().url(),
  originalUrl: z.string().url(),
});
const cliFindingsSchema = z.object({
  runsPerRoute: z.number().int().positive(),
  environment: z.object({
    formFactor: z.literal("desktop"),
    throttling: z.object({ cpuSlowdownMultiplier: z.literal(1) }),
  }),
  sites: z.object({
    new: z.object({
      routes: z.object({ "/": z.object({ fcp: z.number() }) }).passthrough(),
    }),
    original: z.object({
      routes: z.object({ "/": z.object({ fcp: z.number() }) }).passthrough(),
    }),
  }),
});
const performanceConfig = performanceConfigSchema.parse(
  JSON.parse(
    readFileSync(path.join(workspace, "performance.config.json"), "utf8"),
  ),
);
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

function createFixtureDirectory(runs = performanceConfig.minimumRuns) {
  const directory = mkdtempSync(path.join(tmpdir(), "perf-audit."));
  temporaryDirectories.push(directory);
  const routes = performanceConfig.routes.map((route: string) =>
    route === "/" ? "home" : route.slice(1),
  );
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
      {
        cwd: directory,
        encoding: "utf8",
        env: { ...process.env, PERF_FINDINGS_STDOUT: "1" },
      },
    );
    const findings = cliFindingsSchema.parse(JSON.parse(output));
    const report = readFileSync(
      path.join(directory, "docs/perf-report.md"),
      "utf8",
    );

    expect(findings.runsPerRoute).toBe(performanceConfig.minimumRuns);
    expect(findings.environment.formFactor).toBe("desktop");
    expect(findings.environment.throttling.cpuSlowdownMultiplier).toBe(1);
    expect(findings.sites.new.routes["/"].fcp).toBe(130);
    expect(findings.sites.original.routes["/"].fcp).toBe(230);
    expect(report).toContain("| FCP | 130 ms | 230 ms | -100 ms |");
    expect(report).toContain(
      "Absolute CPU- and network-bound timings are host-dependent",
    );
    expect(report).toContain("cpuSlowdownMultiplier");
  });

  it("fails clearly when a route has fewer than five runs", () => {
    const directory = createFixtureDirectory(performanceConfig.minimumRuns - 1);
    const result = spawnSync(
      process.execPath,
      [script, "--summarize-fixtures", directory],
      { cwd: directory, encoding: "utf8" },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("at least 5 are required");
  }, 10_000);

  it("keeps the documented route and run contract synchronized", () => {
    const readme = readFileSync(path.join(workspace, "README.md"), "utf8");
    for (const route of performanceConfig.routes) {
      expect(readme).toContain(`\`${route}\``);
    }
    expect(readme).toContain(
      `At least \`${performanceConfig.minimumRuns}\` runs`,
    );
  });

  it("rejects a non-HTTP deployment URL at the CLI boundary", () => {
    const directory = createFixtureDirectory();
    const result = spawnSync(
      process.execPath,
      [script, "--summarize-fixtures", directory],
      {
        cwd: directory,
        encoding: "utf8",
        env: { ...process.env, PERF_URL: "file:///tmp/site" },
      },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("PERF_URL must be a valid HTTP(S) URL");
  }, 10_000);

  it("rejects an invalid performance configuration at the file boundary", () => {
    const directory = createFixtureDirectory();
    const invalidConfig = path.join(directory, "invalid-config.json");
    writeFileSync(invalidConfig, JSON.stringify({ routes: "all" }));
    const result = spawnSync(
      process.execPath,
      [script, "--config", invalidConfig, "--summarize-fixtures", directory],
      { cwd: directory, encoding: "utf8" },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("performance config is invalid");
  });

  it("rejects a malformed Lighthouse fixture at the report boundary", () => {
    const directory = createFixtureDirectory();
    writeFileSync(path.join(directory, "new-home-1.json"), "{}");
    const result = spawnSync(
      process.execPath,
      [script, "--summarize-fixtures", directory],
      { cwd: directory, encoding: "utf8" },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("fixture new-home-1.json is invalid");
  });

  it("gates the committed report against its structured findings", () => {
    const result = spawnSync(process.execPath, [script, "--check-report"], {
      cwd: workspace,
      encoding: "utf8",
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe(
      "Performance report matches structured findings.\n",
    );
  });

  it("fails the freshness gate when the readable report drifts", () => {
    const directory = createFixtureDirectory();
    execFileSync(
      process.execPath,
      [script, "--summarize-fixtures", directory],
      {
        cwd: directory,
      },
    );
    writeFileSync(
      path.join(directory, "docs/perf-report.md"),
      "stale report\n",
    );
    const result = spawnSync(process.execPath, [script, "--check-report"], {
      cwd: directory,
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("docs/perf-report.md is stale");
  });
});
