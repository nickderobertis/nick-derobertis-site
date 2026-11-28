import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

// scripts/ci/verify-runtime-pins.mjs is the CLI these tests own, reached the way
// a contributor reaches it: through `just lint-workflows`.
// Every workflow provisions bun and Node itself, so those pins are a contract
// with exactly one authoritative source: package.json's `packageManager` for
// bun, and — because nothing declares Node — agreement across workflows for
// Node. The Biome schema and the Playwright capture image restate the
// versions package.json pins for those tools, so they are held to it too.
// `just lint-workflows` is the gate that enforces it, and it is the only
// interface these tests use: each drift case moves one pin in the committed
// tree exactly as a contributor would, runs the real recipe, and restores the
// file, so what fails the push here is what fails it in CI. Because a drifted
// pin is briefly the committed tree, tooling-ci's test target declares
// `parallelism: false`: another project's gate reading package.json or a
// workflow mid-case would otherwise see this file's edit as its own failure.

const pinnedWorkflow = ".github/workflows/pages.yml";
const manifest = "package.json";
const captureWorkflow = ".github/workflows/visual-docs.yml";
const toolVersions = ".tool-versions";
const visualTools = "visual-tools.json";

/** package.json is config on disk, so the pin is narrowed before it is used. */
function declaredPackageManager(): string {
  const parsed: unknown = JSON.parse(readFileSync(manifest, "utf8"));
  const declared: unknown =
    parsed && typeof parsed === "object" && "packageManager" in parsed
      ? parsed.packageManager
      : undefined;
  if (typeof declared !== "string")
    throw new Error(`${manifest} must declare a string packageManager pin`);
  return declared;
}

/** The exact version package.json pins a tool to, narrowed the same way. */
function declaredDevDependency(name: string): string {
  const parsed: unknown = JSON.parse(readFileSync(manifest, "utf8"));
  const dependencies: unknown =
    parsed && typeof parsed === "object" && "devDependencies" in parsed
      ? parsed.devDependencies
      : undefined;
  const declared: unknown =
    dependencies && typeof dependencies === "object" && name in dependencies
      ? (dependencies as Record<string, unknown>)[name]
      : undefined;
  if (typeof declared !== "string")
    throw new Error(`${manifest} must pin ${name} as a string`);
  return declared;
}

function lintWorkflows() {
  return spawnSync("just", ["lint-workflows"], { encoding: "utf8" });
}

/**
 * Applies one edit per file to the committed tree, runs the real gate over the
 * drifted result, and restores every file it touched even when an expectation
 * throws.
 */
function lintWithDrift(edits: Record<string, readonly [string, string]>) {
  const planned = Object.entries(edits).map(([file, [from, to]]) => ({
    file,
    from,
    to,
    original: readFileSync(file, "utf8"),
  }));
  try {
    for (const { file, from, to, original } of planned) {
      expect(original).toContain(from);
      writeFileSync(file, original.replace(from, to));
    }
    return lintWorkflows();
  } finally {
    for (const { file, original } of planned) writeFileSync(file, original);
  }
}

describe("workflow runtime pins", () => {
  test("the gate reports the committed pins agreeing", () => {
    const declared = declaredPackageManager().replace("bun@", "");

    const result = lintWorkflows();

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(`runtime pins agree: bun ${declared}`);
  }, 180_000);

  test("a workflow provisioning a different bun than package.json fails the gate", () => {
    const declared = declaredPackageManager().replace("bun@", "");
    const result = lintWithDrift({
      [pinnedWorkflow]: [`BUN_VERSION: ${declared}`, "BUN_VERSION: 1.0.0"],
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(
      /package\.json pins bun [\d.]+ but .*pages\.yml pins 1\.0\.0/,
    );
    expect(result.stderr).toContain(
      "lint-workflows: workflow runtime pins drifted",
    );
  }, 180_000);

  test("a capture command installing a different bun inside its container fails the gate", () => {
    const declared = declaredPackageManager().replace("bun@", "");
    const result = lintWithDrift({
      [captureWorkflow]: [
        `npm install -g bun@${declared}`,
        "npm install -g bun@1.0.0",
      ],
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/visual-docs\.yml pins 1\.0\.0/);
  }, 180_000);

  test("a .tool-versions naming a different bun fails the gate", () => {
    const declared = declaredPackageManager().replace("bun@", "");
    const result = lintWithDrift({
      [toolVersions]: [`bun ${declared}`, "bun 1.0.0"],
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/\.tool-versions pins 1\.0\.0/);
  }, 180_000);

  test("workflows that disagree on the Node runtime fail the gate", () => {
    const result = lintWithDrift({
      [pinnedWorkflow]: ["NODE_VERSION: 26.5.0", "NODE_VERSION: 22.1.0"],
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(
      /workflows disagree on the Node runtime.*22\.1\.0/s,
    );
  }, 180_000);

  test("a manifest without an exact package manager pin fails the gate", () => {
    const declared = declaredPackageManager();

    const result = lintWithDrift({
      [manifest]: [
        `"packageManager": "${declared}"`,
        '"packageManager": "bun@latest"',
      ],
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/authoritative bun pin/);
  }, 180_000);

  test("a Biome schema naming a different release than package.json fails the gate", () => {
    const result = lintWithDrift({
      "biome.json": [
        `schemas/${declaredDevDependency("@biomejs/biome")}/`,
        "schemas/2.0.0/",
      ],
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(
      /package\.json pins @biomejs\/biome [\d.]+ but biome\.json names 2\.0\.0/,
    );
  }, 180_000);

  test("a capture container for a different Playwright than package.json fails the gate", () => {
    // The visual contract already holds the workflow to visual-tools.json, so
    // the drift that reaches this gate moves both together.
    const container = `playwright:v${declaredDevDependency("@playwright/test")}-`;
    const result = lintWithDrift({
      [visualTools]: [container, "playwright:v1.0.0-"],
      [captureWorkflow]: [container, "playwright:v1.0.0-"],
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(
      /package\.json pins @playwright\/test [\d.]+ but visual-tools\.json names 1\.0\.0/,
    );
  }, 180_000);

  test("every drift case leaves the committed pins exactly as it found them", () => {
    const declared = declaredPackageManager().replace("bun@", "");
    expect(readFileSync(pinnedWorkflow, "utf8")).toContain(
      `BUN_VERSION: ${declared}`,
    );
    expect(readFileSync(captureWorkflow, "utf8")).toContain(
      `npm install -g bun@${declared}`,
    );
    expect(readFileSync(toolVersions, "utf8")).toContain(`bun ${declared}`);
    expect(readFileSync(pinnedWorkflow, "utf8")).toContain(
      "NODE_VERSION: 26.5.0",
    );
    expect(readFileSync(manifest, "utf8")).toMatch(
      /"packageManager": "bun@\d+\.\d+\.\d+"/,
    );
    expect(readFileSync("biome.json", "utf8")).toContain(
      `schemas/${declaredDevDependency("@biomejs/biome")}/`,
    );
    expect(readFileSync(visualTools, "utf8")).toContain(
      `playwright:v${declaredDevDependency("@playwright/test")}-`,
    );
  });
});
