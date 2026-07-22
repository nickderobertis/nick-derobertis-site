import { accessSync, constants, readFileSync } from "node:fs";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { z } from "zod";

const httpUrl = z
  .string()
  .url()
  .refine((value) => ["http:", "https:"].includes(new URL(value).protocol), {
    message: "must use HTTP(S)",
  });
const absoluteDirectory = z
  .string()
  .min(1)
  .refine((value) => path.isAbsolute(value), {
    message: "must be an absolute directory path",
  });
const configSchema = z.object({
  routes: z
    .array(
      z
        .string()
        .regex(
          /^\/(?:[a-z0-9-]+\/?)*(?:\?[a-z0-9-]+=(?:loading|empty|error))?$/,
        ),
    )
    .min(1),
  minimumRuns: z.number().int().min(1),
  newUrl: httpUrl,
  originalUrl: httpUrl,
});
const numberSchema = z.number().finite();
const lhrSchema = z.object({
  lighthouseVersion: z.string().min(1),
  userAgent: z.string().min(1),
  configSettings: z.object({
    formFactor: z.string(),
    throttlingMethod: z.string(),
    throttling: z.object({ cpuSlowdownMultiplier: numberSchema }).passthrough(),
  }),
  categories: z.object({
    performance: z.object({ score: numberSchema }),
  }),
  audits: z.object({
    "first-contentful-paint": z.object({ numericValue: numberSchema }),
    "largest-contentful-paint": z.object({ numericValue: numberSchema }),
    "total-blocking-time": z.object({ numericValue: numberSchema }),
    "cumulative-layout-shift": z.object({ numericValue: numberSchema }),
    "total-byte-weight": z.object({ numericValue: numberSchema }),
    "resource-summary": z.object({
      details: z.object({
        items: z.array(
          z.object({
            resourceType: z.string(),
            transferSize: numberSchema.optional(),
          }),
        ),
      }),
    }),
  }),
});
const metricSchema = z.object({
  performance: numberSchema,
  fcp: numberSchema,
  lcp: numberSchema,
  tbt: numberSchema,
  cls: numberSchema,
  transferBytes: numberSchema,
  jsBytes: numberSchema,
});
const findingsSchema = z.object({
  schemaVersion: z.literal(1),
  runsPerRoute: z.number().int().min(1),
  environment: z.object({
    capturedAt: z.string().datetime(),
    host: z.string(),
    cpu: z.string(),
    logicalCpus: z.number().int().positive(),
    memoryGiB: numberSchema,
    node: z.string(),
    lighthouse: z.string(),
    userAgent: z.string(),
    formFactor: z.literal("desktop"),
    throttlingMethod: z.string(),
    throttling: z.object({ cpuSlowdownMultiplier: z.literal(1) }).passthrough(),
  }),
  sites: z.object({
    new: z.object({ url: httpUrl, routes: z.record(z.string(), metricSchema) }),
    original: z.object({
      url: httpUrl,
      routes: z.record(z.string(), metricSchema),
    }),
  }),
  deltas: z.record(z.string(), metricSchema),
});

function parseJsonFile(filename, schema, label) {
  try {
    return schema.parse(JSON.parse(readFileSync(filename, "utf8")));
  } catch (error) {
    throw new Error(`${label} is invalid: ${error.message}`);
  }
}

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const name = values[index];
    if (["--check-report", "--refresh-report"].includes(name)) {
      parsed[name === "--check-report" ? "checkReport" : "refreshReport"] =
        true;
      continue;
    }
    if (!["--config", "--summarize-fixtures"].includes(name)) {
      throw new Error(`unknown argument ${name}`);
    }
    const value = values[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${name} requires a path`);
    }
    parsed[name === "--config" ? "configPath" : "fixtureDirectory"] = value;
    index += 1;
  }
  return parsed;
}
let cli = {};
let config;
let ROUTES;
let DEFAULT_NEW_URL;
let DEFAULT_ORIGINAL_URL;
let DEFAULT_RUNS;
const METRICS = [
  ["performance", "Performance", "score"],
  ["fcp", "FCP", "ms"],
  ["lcp", "LCP", "ms"],
  ["tbt", "TBT", "ms"],
  ["cls", "CLS", "number"],
  ["transferBytes", "Transfer", "bytes"],
  ["jsBytes", "JavaScript", "bytes"],
];

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function metricFromLhr(lhr) {
  lhr = lhrSchema.parse(lhr);
  const scripts = lhr.audits["resource-summary"].details.items.find(
    (item) => item.resourceType === "script",
  );
  return {
    performance: lhr.categories.performance.score * 100,
    fcp: lhr.audits["first-contentful-paint"].numericValue,
    lcp: lhr.audits["largest-contentful-paint"].numericValue,
    tbt: lhr.audits["total-blocking-time"].numericValue,
    cls: lhr.audits["cumulative-layout-shift"].numericValue,
    transferBytes: lhr.audits["total-byte-weight"].numericValue,
    jsBytes: scripts?.transferSize ?? 0,
  };
}

function assertDesktopProfile(lhr) {
  lhr = lhrSchema.parse(lhr);
  const { formFactor, throttling } = lhr.configSettings;
  if (formFactor !== "desktop" || throttling.cpuSlowdownMultiplier !== 1) {
    throw new Error(
      `Lighthouse profile mismatch: expected desktop with 1x CPU throttling, recorded ${formFactor} with ${throttling.cpuSlowdownMultiplier}x`,
    );
  }
}

function aggregate(runs) {
  return Object.fromEntries(
    METRICS.map(([key]) => [key, median(runs.map((run) => run[key]))]),
  );
}

function routeUrl(base, route) {
  const normalized = base.endsWith("/") ? base : `${base}/`;
  return new URL(route.replace(/^\//, ""), normalized).href;
}

function deploymentUrl(value, name) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid HTTP(S) URL`);
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error(`${name} must be a valid HTTP(S) URL`);
  }
  return url.href;
}

function format(value, unit) {
  if (unit === "score") return value.toFixed(0);
  if (unit === "ms") return `${Math.round(value)} ms`;
  if (unit === "bytes") return `${(value / 1024).toFixed(1)} KiB`;
  return value.toFixed(3);
}

function delta(value, baseline, unit) {
  const difference = value - baseline;
  const prefix = difference > 0 ? "+" : "";
  return `${prefix}${format(difference, unit)}`;
}

function environment(lhr) {
  return {
    capturedAt: new Date().toISOString(),
    host: `${os.type()} ${os.release()} ${os.arch()}`,
    cpu: os.cpus()[0]?.model ?? "unknown",
    logicalCpus: os.cpus().length,
    memoryGiB: Number((os.totalmem() / 1024 ** 3).toFixed(1)),
    node: process.version,
    lighthouse: lhr.lighthouseVersion,
    userAgent: lhr.userAgent,
    formFactor: lhr.configSettings.formFactor,
    throttlingMethod: lhr.configSettings.throttlingMethod,
    throttling: lhr.configSettings.throttling,
  };
}

function markdown(findings) {
  const { environment: env, runsPerRoute, sites } = findings;
  const lines = [
    "# Deployment performance comparison",
    "",
    `Generated ${env.capturedAt} with Lighthouse ${env.lighthouse} using ${runsPerRoute} runs per route. Timing values are the median of all runs; byte and score values are also medians for consistency.`,
    "",
    "> Absolute CPU- and network-bound timings are host-dependent because these audits run from a shared host against live deployments. Compare runs made on the same representative host. Transfer bytes and CLS deltas are substantially more stable.",
    "",
    "## Methodology and environment",
    "",
    `- Explicit Lighthouse preset: \`desktop\` (${env.formFactor} form factor, \`${env.throttlingMethod}\` throttling)`,
    `- Applied throttling: \`${JSON.stringify(env.throttling)}\``,
    `- Host: ${env.host}; ${env.cpu}; ${env.logicalCpus} logical CPUs; ${env.memoryGiB} GiB RAM`,
    `- Runtime: ${env.node}; user agent: ${env.userAgent}`,
    `- New deployment: ${sites.new.url}`,
    `- Original deployment: ${sites.original.url}`,
    "",
    "Lower is better for every metric except Performance score, where higher is better. Deltas are new minus original.",
    "",
  ];

  for (const route of ROUTES) {
    const current = sites.new.routes[route];
    const original = sites.original.routes[route];
    lines.push(
      `## \`${route}\``,
      "",
      "| Metric | New | Original | Delta |",
      "| --- | ---: | ---: | ---: |",
    );
    for (const [key, label, unit] of METRICS) {
      lines.push(
        `| ${label} | ${format(current[key], unit)} | ${format(original[key], unit)} | ${delta(current[key], original[key], unit)} |`,
      );
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

function validateFindings(value) {
  const findings = findingsSchema.parse(value);
  for (const site of [findings.sites.new, findings.sites.original]) {
    if (Object.keys(site.routes).sort().join() !== [...ROUTES].sort().join()) {
      throw new Error(
        "structured findings routes do not match performance config",
      );
    }
  }
  if (
    Object.keys(findings.deltas).sort().join() !== [...ROUTES].sort().join()
  ) {
    throw new Error("structured delta routes do not match performance config");
  }
  return findings;
}

function routeName(route) {
  return route === "/"
    ? "home"
    : route
        .replace(/^\//, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/-$/, "");
}

async function auditSite(
  label,
  baseUrl,
  runs,
  chromePort,
  lighthouse,
  desktopConfig,
  rawDirectory,
) {
  const routes = {};
  let firstLhr;
  for (const route of ROUTES) {
    const samples = [];
    for (let run = 1; run <= runs; run += 1) {
      const url = routeUrl(baseUrl, route);
      const result = await lighthouse(
        url,
        {
          port: chromePort,
          output: "json",
          logLevel: "error",
        },
        desktopConfig,
      );
      if (!result?.lhr)
        throw new Error(`Lighthouse returned no result for ${url}`);
      const lhr = lhrSchema.parse(result.lhr);
      assertDesktopProfile(lhr);
      if (rawDirectory) {
        await mkdir(rawDirectory, { recursive: true });
        await writeFile(
          path.join(rawDirectory, `${label}-${routeName(route)}-${run}.json`),
          `${JSON.stringify(lhr)}\n`,
        );
      }
      firstLhr ??= lhr;
      samples.push(metricFromLhr(lhr));
    }
    routes[route] = aggregate(samples);
  }
  return { url: baseUrl, routes, firstLhr };
}

async function readFixtureSite(directory, label, baseUrl) {
  const routes = {};
  let firstLhr;
  for (const route of ROUTES) {
    const routeSlug = routeName(route);
    const names = (await readdir(directory)).filter((filename) =>
      filename.startsWith(`${label}-${routeSlug}-`),
    );
    if (names.length < DEFAULT_RUNS) {
      throw new Error(
        `${label} ${route} has ${names.length} fixture runs; at least ${DEFAULT_RUNS} are required`,
      );
    }
    const samples = [];
    for (const name of names.sort()) {
      let lhr;
      try {
        lhr = lhrSchema.parse(
          JSON.parse(await readFile(path.join(directory, name), "utf8")),
        );
      } catch (error) {
        throw new Error(`fixture ${name} is invalid: ${error.message}`);
      }
      assertDesktopProfile(lhr);
      firstLhr ??= lhr;
      samples.push(metricFromLhr(lhr));
    }
    routes[route] = aggregate(samples);
  }
  return { url: baseUrl, routes, firstLhr, runs: DEFAULT_RUNS };
}

async function main() {
  cli = parseArgs(process.argv.slice(2));
  const configPath =
    cli.configPath ??
    process.env.PERF_CONFIG ??
    new URL("../performance.config.json", import.meta.url);
  config = parseJsonFile(configPath, configSchema, "performance config");
  ROUTES = config.routes;
  DEFAULT_NEW_URL = config.newUrl;
  DEFAULT_ORIGINAL_URL = config.originalUrl;
  DEFAULT_RUNS = config.minimumRuns;
  const fixtureDirectory = cli.fixtureDirectory ?? null;
  if (
    fixtureDirectory &&
    (!fixtureDirectory ||
      !(await stat(fixtureDirectory).catch(() => null))?.isDirectory())
  ) {
    throw new Error("--summarize-fixtures must name a readable directory");
  }
  if (cli.checkReport || cli.refreshReport) {
    const findings = parseJsonFile(
      "docs/perf-findings.json",
      findingsSchema,
      "structured performance findings",
    );
    validateFindings(findings);
    const expected = markdown(findings);
    if (cli.refreshReport) {
      await writeFile("docs/perf-report.md", expected);
      process.stdout.write(
        "Refreshed performance report from structured findings.\n",
      );
      return;
    }
    const actual = await readFile("docs/perf-report.md", "utf8");
    if (actual !== expected) {
      throw new Error(
        "docs/perf-report.md is stale; regenerate it from the committed findings",
      );
    }
    process.stdout.write("Performance report matches structured findings.\n");
    return;
  }
  const newUrl = deploymentUrl(
    process.env.PERF_URL || DEFAULT_NEW_URL,
    "PERF_URL",
  );
  const originalUrl = deploymentUrl(
    process.env.PERF_ORIGINAL_URL || DEFAULT_ORIGINAL_URL,
    "PERF_ORIGINAL_URL",
  );
  const runs = Number(process.env.PERF_RUNS || DEFAULT_RUNS);
  if (!Number.isInteger(runs) || runs < DEFAULT_RUNS) {
    throw new Error(`PERF_RUNS must be an integer of at least ${DEFAULT_RUNS}`);
  }

  let current;
  let original;
  let chrome;
  const rawDirectory = process.env.PERF_RAW_DIR
    ? absoluteDirectory.parse(process.env.PERF_RAW_DIR)
    : null;
  const outputDirectory = process.env.PERF_OUTPUT_DIR
    ? absoluteDirectory.parse(process.env.PERF_OUTPUT_DIR)
    : "docs";
  const reuseIdentical = process.env.PERF_LOCAL_REUSE_IDENTICAL === "1";
  if (
    process.env.PERF_LOCAL_REUSE_IDENTICAL &&
    process.env.PERF_LOCAL_REUSE_IDENTICAL !== "1"
  ) {
    throw new Error("PERF_LOCAL_REUSE_IDENTICAL must be 1 when set");
  }
  if (reuseIdentical && newUrl !== originalUrl) {
    throw new Error(
      "PERF_LOCAL_REUSE_IDENTICAL requires identical new and original URLs",
    );
  }
  try {
    if (fixtureDirectory) {
      current = await readFixtureSite(fixtureDirectory, "new", newUrl);
      original = await readFixtureSite(
        fixtureDirectory,
        "original",
        originalUrl,
      );
    } else {
      const [{ chromium }, chromeLauncher, lighthouseModule] =
        await Promise.all([
          import("@playwright/test"),
          import("chrome-launcher"),
          import("lighthouse"),
        ]);
      const chromePath = process.env.CHROME_PATH ?? chromium.executablePath();
      try {
        accessSync(chromePath, constants.X_OK);
      } catch {
        throw new Error(
          `Chrome executable is missing or not executable: ${chromePath}`,
        );
      }
      chrome = await chromeLauncher.launch({
        chromePath,
        chromeFlags: ["--headless", "--no-sandbox"],
      });
      current = await auditSite(
        "new",
        newUrl,
        runs,
        chrome.port,
        lighthouseModule.default,
        lighthouseModule.desktopConfig,
        rawDirectory,
      );
      if (reuseIdentical) {
        original = structuredClone(current);
        original.url = originalUrl;
        if (rawDirectory) {
          for (const filename of await readdir(rawDirectory)) {
            if (!filename.startsWith("new-")) continue;
            await writeFile(
              path.join(rawDirectory, filename.replace(/^new-/, "original-")),
              await readFile(path.join(rawDirectory, filename)),
            );
          }
        }
      } else {
        original = await auditSite(
          "original",
          originalUrl,
          runs,
          chrome.port,
          lighthouseModule.default,
          lighthouseModule.desktopConfig,
          rawDirectory,
        );
      }
    }
  } finally {
    await chrome?.kill();
  }

  const findings = validateFindings({
    schemaVersion: 1,
    runsPerRoute: fixtureDirectory ? DEFAULT_RUNS : runs,
    environment: environment(current.firstLhr),
    sites: {
      new: { url: current.url, routes: current.routes },
      original: { url: original.url, routes: original.routes },
    },
    deltas: Object.fromEntries(
      ROUTES.map((route) => [
        route,
        Object.fromEntries(
          METRICS.map(([key]) => [
            key,
            current.routes[route][key] - original.routes[route][key],
          ]),
        ),
      ]),
    ),
  });
  await mkdir(outputDirectory, { recursive: true });
  const findingsPath = path.join(outputDirectory, "perf-findings.json");
  const reportPath = path.join(outputDirectory, "perf-report.md");
  await writeFile(findingsPath, `${JSON.stringify(findings, null, 2)}\n`);
  await writeFile(reportPath, markdown(findings));
  if (process.env.PERF_FINDINGS_STDOUT === "1") {
    process.stdout.write(`${JSON.stringify(findings)}\n`);
  } else if (process.env.PERF_FINDINGS_STDOUT) {
    throw new Error("PERF_FINDINGS_STDOUT must be 1 when set");
  } else {
    process.stdout.write(
      `Performance comparison complete for ${ROUTES.length} routes; report: ${reportPath}; structured findings: ${findingsPath}\n`,
    );
  }
}

main().catch((error) => {
  const recovery = cli.checkReport
    ? "run node scripts/performance-audit.mjs --refresh-report, review the diff, then rerun --check-report"
    : cli.refreshReport
      ? "correct docs/perf-findings.json, then rerun --refresh-report"
      : "correct the reported input or environment and rerun the same performance command";
  process.stderr.write(
    `performance audit failed: ${error.message}; ${recovery}\n`,
  );
  process.exitCode = 1;
});
