import {
  type ChildProcess,
  execFile,
  spawn,
  spawnSync,
} from "node:child_process";
import { once } from "node:events";
import { readFileSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";

const execFileAsync = promisify(execFile);
const workspace = path.resolve(import.meta.dirname, "../../../..");
const auditScript = path.join(workspace, "scripts/performance-audit.mjs");
const serverScript = path.join(
  workspace,
  "apps/shell-e2e/src/unit/fixtures/performance-site.mjs",
);
const children: ChildProcess[] = [];
const directories: string[] = [];
const productionConfigSchema = z.object({
  routes: z.array(z.string()).min(1),
  minimumRuns: z.number().int().positive(),
  newUrl: z.string().url(),
  originalUrl: z.string().url(),
});
const productionConfig = productionConfigSchema.parse(
  JSON.parse(
    readFileSync(path.join(workspace, "performance.config.json"), "utf8"),
  ),
);
const localRoutes = [...productionConfig.routes, "/remotes/bio/"];
const localUrlSchema = z
  .string()
  .url()
  .refine((value) => new URL(value).protocol === "http:");
const findingsSchema = z.object({
  environment: z.object({ formFactor: z.literal("desktop") }),
  sites: z.object({
    new: z.object({
      routes: z.record(
        z.string(),
        z.object({ performance: z.number().finite() }),
      ),
    }),
  }),
});

async function localSite() {
  const child = spawn(process.execPath, [serverScript], {
    stdio: ["ignore", "pipe", "inherit"],
  });
  children.push(child);
  if (!child.stdout) throw new Error("local performance server has no stdout");
  const [chunk] = (await once(child.stdout, "data")) as [Buffer];
  return localUrlSchema.parse(chunk.toString().trim());
}

async function localConfig(url: string, routes = localRoutes) {
  const directory = await mkdtemp(path.join(tmpdir(), "perf-browser."));
  directories.push(directory);
  const filename = path.join(directory, "config.json");
  writeFileSync(
    filename,
    JSON.stringify({
      routes,
      minimumRuns: 1,
      newUrl: url,
      originalUrl: url,
    }),
  );
  return { directory, filename };
}

afterEach(async () => {
  for (const child of children.splice(0)) child.kill("SIGTERM");
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true })),
  );
});

describe("performance audit real-browser e2e CLI", () => {
  it("drives every audit and report mode from real local browser results", async () => {
    const url = await localSite();
    const { directory, filename } = await localConfig(url);
    const rawDirectory = path.join(directory, "raw-lighthouse");
    const result = await execFileAsync(
      process.execPath,
      [auditScript, "--config", filename],
      {
        cwd: directory,
        timeout: 240_000,
        env: { ...process.env, PERF_RAW_DIR: rawDirectory },
      },
    );

    expect(result.stdout).toContain(
      `Performance comparison complete for ${localRoutes.length} routes`,
    );
    expect(result.stdout).not.toContain('"schemaVersion"');
    const findings = findingsSchema.parse(
      JSON.parse(
        readFileSync(path.join(directory, "docs/perf-findings.json"), "utf8"),
      ),
    );
    expect(Object.keys(findings.sites.new.routes).sort()).toEqual(
      [...localRoutes].sort(),
    );
    for (const route of localRoutes) {
      expect(findings.sites.new.routes[route]?.performance).toBeGreaterThan(0);
    }
    expect(findings.environment.formFactor).toBe("desktop");

    const summarized = await execFileAsync(
      process.execPath,
      [auditScript, "--config", filename, "--summarize-fixtures", rawDirectory],
      { cwd: directory },
    );
    expect(summarized.stdout).toContain(
      `Performance comparison complete for ${localRoutes.length} routes`,
    );

    const fresh = spawnSync(
      process.execPath,
      [auditScript, "--config", filename, "--check-report"],
      { cwd: directory, encoding: "utf8" },
    );
    expect(fresh.status, fresh.stderr).toBe(0);
    writeFileSync(path.join(directory, "docs/perf-report.md"), "stale\n");
    const stale = spawnSync(
      process.execPath,
      [auditScript, "--config", filename, "--check-report"],
      { cwd: directory, encoding: "utf8" },
    );
    expect(stale.status).toBe(1);
    expect(stale.stderr).toContain("--refresh-report");

    const refreshed = spawnSync(
      process.execPath,
      [auditScript, "--config", filename, "--refresh-report"],
      { cwd: directory, encoding: "utf8" },
    );
    expect(refreshed.status, refreshed.stderr).toBe(0);

    const rawHome = path.join(rawDirectory, "new-home-1.json");
    writeFileSync(rawHome, "{}");
    const malformed = spawnSync(
      process.execPath,
      [auditScript, "--config", filename, "--summarize-fixtures", rawDirectory],
      { cwd: directory, encoding: "utf8" },
    );
    expect(malformed.status).toBe(1);
    expect(malformed.stderr).toContain("fixture new-home-1.json is invalid");
  }, 240_000);

  it("reports actionable browser startup failure through the real CLI", async () => {
    const url = await localSite();
    const { directory, filename } = await localConfig(url);
    const result = spawnSync(
      process.execPath,
      [auditScript, "--config", filename],
      {
        cwd: directory,
        encoding: "utf8",
        env: {
          ...process.env,
          CHROME_PATH: path.join(directory, "missing-chrome"),
        },
      },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "correct the reported input or environment",
    );
  });

  it("drives concise success and actionable failure through both just recipes", async () => {
    const url = await localSite();
    const { directory, filename } = await localConfig(url, ["/"]);
    const outputDirectory = path.join(directory, "recipe-output");
    const environment = {
      ...process.env,
      PERF_CONFIG: filename,
      PERF_OUTPUT_DIR: outputDirectory,
    };
    const perf = await execFileAsync("just", ["perf", url, "1"], {
      cwd: workspace,
      env: environment,
      timeout: 120_000,
    });
    expect(perf.stdout.trim().split("\n")).toHaveLength(1);
    expect(perf.stdout).toContain(
      "Performance comparison complete for 1 routes",
    );

    const compare = await execFileAsync(
      "just",
      ["perf-compare", url, url, "1"],
      { cwd: workspace, env: environment, timeout: 120_000 },
    );
    expect(compare.stdout.trim().split("\n")).toHaveLength(1);
    expect(compare.stdout).toContain(
      "Performance comparison complete for 1 routes",
    );

    const perfFailure = spawnSync("just", ["perf", "file:///invalid", "1"], {
      cwd: workspace,
      env: environment,
      encoding: "utf8",
    });
    expect(perfFailure.status).toBe(1);
    expect(perfFailure.stderr).toContain("rerun just perf");

    const compareFailure = spawnSync(
      "just",
      ["perf-compare", url, "file:///invalid", "1"],
      { cwd: workspace, env: environment, encoding: "utf8" },
    );
    expect(compareFailure.status).toBe(1);
    expect(compareFailure.stderr).toContain("rerun just perf-compare");
  }, 180_000);
});
