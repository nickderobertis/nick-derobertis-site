import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";

// Every workflow provisions pnpm and Node itself, so those pins are a contract
// with exactly one authoritative source: package.json's `packageManager` for
// pnpm, and — because nothing declares Node — agreement across workflows for
// Node. scripts/verify-runtime-pins.mjs is the drift gate `just lint-workflows`
// runs; these tests drive it as a real subprocess over the committed tree and
// over copies of that tree with one pin moved.

const verifier = path.resolve("scripts/verify-runtime-pins.mjs");

function verify(cwd: string) {
  return spawnSync("node", [verifier], { cwd, encoding: "utf8" });
}

/**
 * A throwaway copy of exactly what the gate reads — the manifest and the
 * workflows — so a drifted pin can be introduced without touching the
 * committed tree.
 */
function workspaceWith(
  edit: (files: { manifest: string; workflows: Map<string, string> }) => void,
) {
  const root = mkdtempSync(path.join(tmpdir(), "runtime-pins-"));
  const workflowRoot = path.join(root, ".github", "workflows");
  mkdirSync(workflowRoot, { recursive: true });
  const files = {
    manifest: readFileSync("package.json", "utf8"),
    workflows: new Map(
      readdirSync(".github/workflows")
        .filter((name) => name.endsWith(".yml"))
        .map((name) => [
          name,
          readFileSync(path.join(".github/workflows", name), "utf8"),
        ]),
    ),
  };
  edit(files);
  writeFileSync(path.join(root, "package.json"), files.manifest);
  for (const [name, source] of files.workflows)
    writeFileSync(path.join(workflowRoot, name), source);
  return root;
}

function verifyWith(
  edit: (files: { manifest: string; workflows: Map<string, string> }) => void,
) {
  const root = workspaceWith(edit);
  try {
    return verify(root);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
}

describe("workflow runtime pins", () => {
  test("the committed workflows agree with the declared package manager", () => {
    const result = verify(process.cwd());
    const declared = JSON.parse(
      readFileSync("package.json", "utf8"),
    ).packageManager;

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      `runtime pins agree: pnpm ${declared.replace("pnpm@", "")}`,
    );
  });

  test("a workflow that provisions a different pnpm than package.json is rejected", () => {
    const result = verifyWith((files) => {
      files.workflows.set(
        "drifted.yml",
        "name: Drifted\non: workflow_dispatch\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: pnpm/action-setup@v4\n        with: {version: 9.0.0}\n      - uses: actions/setup-node@v4\n        with: {node-version: 26.5.0}\n",
      );
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(
      /package\.json pins pnpm [\d.]+ but .*drifted\.yml pins 9\.0\.0/,
    );
  });

  test("workflows that disagree on the Node runtime are rejected", () => {
    const result = verifyWith((files) => {
      files.workflows.set(
        "drifted.yml",
        "name: Drifted\non: workflow_dispatch\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/setup-node@v4\n        with: {node-version: 22.1.0}\n",
      );
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(
      /workflows disagree on the Node runtime.*22\.1\.0/s,
    );
  });

  test("a manifest without an exact package manager pin is rejected", () => {
    const result = verifyWith((files) => {
      files.manifest = files.manifest.replace(
        /"packageManager": "[^"]*"/,
        '"packageManager": "pnpm@latest"',
      );
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/authoritative pnpm pin/);
  });
});
