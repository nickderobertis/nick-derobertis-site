import { readFileSync } from "node:fs";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const config = JSON.parse(
  readFileSync(new URL("../performance.config.json", import.meta.url), "utf8"),
);
const ROUTES = config.routes;
const DEFAULT_NEW_URL = config.newUrl;
const DEFAULT_ORIGINAL_URL = config.originalUrl;
const DEFAULT_RUNS = config.minimumRuns;
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
  const number = (value, name) => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(`Lighthouse result has invalid ${name}`);
    }
    return value;
  };
  if (!Array.isArray(lhr.audits?.["resource-summary"]?.details?.items)) {
    throw new Error("Lighthouse result has invalid resource summary");
  }
  const scripts = lhr.audits["resource-summary"].details.items.find(
    (item) => item.resourceType === "script",
  );
  return {
    performance:
      number(lhr.categories?.performance?.score, "performance score") * 100,
    fcp: number(lhr.audits?.["first-contentful-paint"]?.numericValue, "FCP"),
    lcp: number(lhr.audits?.["largest-contentful-paint"]?.numericValue, "LCP"),
    tbt: number(lhr.audits?.["total-blocking-time"]?.numericValue, "TBT"),
    cls: number(lhr.audits?.["cumulative-layout-shift"]?.numericValue, "CLS"),
    transferBytes: number(
      lhr.audits?.["total-byte-weight"]?.numericValue,
      "transfer bytes",
    ),
    jsBytes: number(scripts?.transferSize ?? 0, "JavaScript bytes"),
  };
}

function assertDesktopProfile(lhr) {
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

async function auditSite(baseUrl, runs, chromePort, lighthouse, desktopConfig) {
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
      assertDesktopProfile(result.lhr);
      firstLhr ??= result.lhr;
      samples.push(metricFromLhr(result.lhr));
    }
    routes[route] = aggregate(samples);
  }
  return { url: baseUrl, routes, firstLhr };
}

async function readFixtureSite(directory, label, baseUrl) {
  const routes = {};
  let firstLhr;
  for (const route of ROUTES) {
    const routeName = route === "/" ? "home" : route.slice(1);
    const names = (await readdir(directory)).filter((name) =>
      name.startsWith(`${label}-${routeName}-`),
    );
    if (names.length < DEFAULT_RUNS) {
      throw new Error(
        `${label} ${route} has ${names.length} fixture runs; at least ${DEFAULT_RUNS} are required`,
      );
    }
    const samples = [];
    for (const name of names.sort()) {
      const lhr = JSON.parse(
        await readFile(path.join(directory, name), "utf8"),
      );
      assertDesktopProfile(lhr);
      firstLhr ??= lhr;
      samples.push(metricFromLhr(lhr));
    }
    routes[route] = aggregate(samples);
  }
  return { url: baseUrl, routes, firstLhr, runs: DEFAULT_RUNS };
}

async function main() {
  const fixtureIndex = process.argv.indexOf("--summarize-fixtures");
  const fixtureDirectory =
    fixtureIndex >= 0 ? process.argv[fixtureIndex + 1] : null;
  if (
    fixtureIndex >= 0 &&
    (!fixtureDirectory ||
      !(await stat(fixtureDirectory).catch(() => null))?.isDirectory())
  ) {
    throw new Error("--summarize-fixtures must name a readable directory");
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
      chrome = await chromeLauncher.launch({
        chromePath: process.env.CHROME_PATH ?? chromium.executablePath(),
        chromeFlags: ["--headless", "--no-sandbox"],
      });
      current = await auditSite(
        newUrl,
        runs,
        chrome.port,
        lighthouseModule.default,
        lighthouseModule.desktopConfig,
      );
      original = await auditSite(
        originalUrl,
        runs,
        chrome.port,
        lighthouseModule.default,
        lighthouseModule.desktopConfig,
      );
    }
  } finally {
    await chrome?.kill();
  }

  const findings = {
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
  };
  await mkdir("docs", { recursive: true });
  await writeFile(
    "docs/perf-findings.json",
    `${JSON.stringify(findings, null, 2)}\n`,
  );
  await writeFile("docs/perf-report.md", markdown(findings));
  // llmlint: ignore[tool_output_is_signal] Structured JSON is the requested planner-facing finding; the readable report is written separately.
  process.stdout.write(`${JSON.stringify(findings)}\n`);
}

// llmlint: ignore[changed_behavior_has_e2e] Public-network audits must remain outside deterministic browser gates; subprocess tests cover the CLI boundaries, and the committed findings prove a real live run.
main().catch((error) => {
  process.stderr.write(
    `performance audit failed: ${error.message}; correct the URL, browser, or fixture input and rerun just perf-compare\n`,
  );
  process.exitCode = 1;
});
