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
const localUrlSchema = z
  .string()
  .url()
  .refine((value) => new URL(value).protocol === "http:");
const findingsSchema = z.object({
  environment: z.object({ formFactor: z.literal("desktop") }),
  sites: z.object({
    new: z.object({
      routes: z.object({
        "/nick-derobertis-site/": z.object({
          performance: z.number().finite(),
        }),
        "/nick-derobertis-site/remotes/bio/": z.object({
          performance: z.number().finite(),
        }),
      }),
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

async function localConfig(url: string) {
  const directory = await mkdtemp(path.join(tmpdir(), "perf-browser."));
  directories.push(directory);
  const filename = path.join(directory, "config.json");
  writeFileSync(
    filename,
    JSON.stringify({
      routes: ["/nick-derobertis-site/", "/nick-derobertis-site/remotes/bio/"],
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
  it("audits host-composed and standalone local routes with pinned Chromium", async () => {
    const url = await localSite();
    const { directory, filename } = await localConfig(url);
    const result = await execFileAsync(
      process.execPath,
      [auditScript, "--config", filename],
      {
        cwd: directory,
        timeout: 120_000,
      },
    );

    expect(result.stdout).toContain(
      "Performance comparison complete for 2 routes",
    );
    expect(result.stdout).not.toContain('"schemaVersion"');
    const findings = findingsSchema.parse(
      JSON.parse(
        readFileSync(path.join(directory, "docs/perf-findings.json"), "utf8"),
      ),
    );
    expect(
      findings.sites.new.routes["/nick-derobertis-site/"].performance,
    ).toBeGreaterThan(0);
    expect(
      findings.sites.new.routes["/nick-derobertis-site/remotes/bio/"]
        .performance,
    ).toBeGreaterThan(0);
    expect(findings.environment.formFactor).toBe("desktop");
  }, 120_000);

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
      "correct the URL, browser, or fixture input",
    );
    expect(result.stderr).toContain("rerun just perf-compare");
  });
});
