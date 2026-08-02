import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

// Every workflow provisions pnpm and Node itself, so those pins are a contract
// with exactly one authoritative source: package.json's `packageManager` for
// pnpm, and — because nothing declares Node — agreement across workflows for
// Node. `just lint-workflows` is the gate that enforces it, and it is the only
// interface these tests use: each drift case moves one pin in the committed
// tree exactly as a contributor would, runs the real recipe, and restores the
// file, so what fails the push here is what fails it in CI.

const pinnedWorkflow = ".github/workflows/pages.yml";
const manifest = "package.json";

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
    const declared = declaredPackageManager().replace("pnpm@", "");

    const result = lintWorkflows();

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(`runtime pins agree: pnpm ${declared}`);
  }, 180_000);

  test("a workflow provisioning a different pnpm than package.json fails the gate", () => {
    const result = lintWithDrift({
      [pinnedWorkflow]: ["PNPM_VERSION: 10.13.1", "PNPM_VERSION: 9.0.0"],
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(
      /package\.json pins pnpm [\d.]+ but .*pages\.yml pins 9\.0\.0/,
    );
    expect(result.stderr).toContain(
      "lint-workflows: workflow runtime pins drifted",
    );
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
        '"packageManager": "pnpm@latest"',
      ],
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/authoritative pnpm pin/);
  }, 180_000);

  test("every drift case leaves the committed pins exactly as it found them", () => {
    expect(readFileSync(pinnedWorkflow, "utf8")).toContain(
      "PNPM_VERSION: 10.13.1",
    );
    expect(readFileSync(pinnedWorkflow, "utf8")).toContain(
      "NODE_VERSION: 26.5.0",
    );
    expect(readFileSync(manifest, "utf8")).toMatch(
      /"packageManager": "pnpm@\d+\.\d+\.\d+"/,
    );
  });
});
