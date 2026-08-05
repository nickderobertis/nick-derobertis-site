import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";

// The reviewed platform contract for the pinned workflow and shell linters.
// `.tools/` provisioning is checksum-verified on every supported host, so these
// specs drive the real installer: its architecture selection, its contract
// validator, and — on this host's own architecture — a real download, checksum
// check, and install.

const workspace = path.resolve(import.meta.dirname, "../..");
const script = path.join(workspace, "scripts/ci/setup-ci-tools.sh");
const installJustScript = path.join(workspace, "scripts/ci/install-just.sh");
const digestSchema = z.object({
  x86_64: z.string().regex(/^[0-9a-f]{64}$/),
  aarch64: z.string().regex(/^[0-9a-f]{64}$/),
});
const contractSchema = z.object({
  schema: z.literal(3),
  actionlint: z.object({
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    sha256: digestSchema,
  }),
  shellcheck: z.object({
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    sha256: digestSchema,
  }),
});
const contractPath = path.join(workspace, "ci-tools.json");
const contract = contractSchema.parse(
  JSON.parse(readFileSync(contractPath, "utf8")),
);
const temporaryDirectories: string[] = [];

function temporaryDirectory(prefix: string) {
  const directory = mkdtempSync(path.join(tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

// A `uname` ahead of the real one on PATH, so a single host can exercise every
// reviewed platform and a rejected one.
// llmlint: ignore-block[e2e_not_mocked] The host CPU is the one input a single machine cannot vary, and the installer under test is never mocked: it is the real script reading a real `uname` process, and the specs below drive its real download, checksum, and install path unmocked on this host's own architecture.
function hostPath(system: string, machine: string) {
  const directory = temporaryDirectory("ci-tools-host.");
  const shim = path.join(directory, "uname");
  writeFileSync(
    shim,
    `#!/bin/sh\ncase "$1" in\n  -s) echo "${system}" ;;\n  -m) echo "${machine}" ;;\n  *) exit 1 ;;\nesac\n`,
    { mode: 0o755 },
  );
  return `${directory}:${process.env.PATH ?? ""}`;
}
// llmlint: ignore-end[e2e_not_mocked]

function runOnHost(system: string, machine: string, args: string[]) {
  return spawnSync(script, args, {
    cwd: workspace,
    encoding: "utf8",
    env: { ...process.env, PATH: hostPath(system, machine) },
  });
}

function runInWorkingDirectory(directory: string, args: string[]) {
  return spawnSync(script, args, {
    cwd: directory,
    encoding: "utf8",
  });
}

// A workspace holding only the pinned contract, so provisioning writes its
// `.tools/` beneath a disposable root.
function contractWorkspace(
  overrides: (parsed: Record<string, unknown>) => void,
) {
  const directory = temporaryDirectory("ci-tools-contract.");
  const parsed = JSON.parse(readFileSync(contractPath, "utf8"));
  overrides(parsed);
  writeFileSync(
    path.join(directory, "ci-tools.json"),
    JSON.stringify(parsed, null, 2),
  );
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    execFileSync("rm", ["-rf", directory]);
  }
});

describe("pinned CI tool platform contract", () => {
  it("selects the amd64/x86_64 upstream archives on Linux x86_64", () => {
    const result = runOnHost("Linux", "x86_64", ["--plan"]);

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe(
      [
        "platform x86_64",
        `actionlint https://github.com/rhysd/actionlint/releases/download/v${contract.actionlint.version}/actionlint_${contract.actionlint.version}_linux_amd64.tar.gz ${contract.actionlint.sha256.x86_64}`,
        `shellcheck https://github.com/koalaman/shellcheck/releases/download/v${contract.shellcheck.version}/shellcheck-v${contract.shellcheck.version}.linux.x86_64.tar.gz ${contract.shellcheck.sha256.x86_64}`,
        "",
      ].join("\n"),
    );
  });

  // actionlint and shellcheck spell the same 64-bit Arm architecture
  // differently, and `uname -m` itself reports either spelling.
  it.each(["aarch64", "arm64"])(
    "selects the arm64/aarch64 upstream archives on Linux %s",
    (machine) => {
      const result = runOnHost("Linux", machine, ["--plan"]);

      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toBe(
        [
          "platform aarch64",
          `actionlint https://github.com/rhysd/actionlint/releases/download/v${contract.actionlint.version}/actionlint_${contract.actionlint.version}_linux_arm64.tar.gz ${contract.actionlint.sha256.aarch64}`,
          `shellcheck https://github.com/koalaman/shellcheck/releases/download/v${contract.shellcheck.version}/shellcheck-v${contract.shellcheck.version}.linux.aarch64.tar.gz ${contract.shellcheck.sha256.aarch64}`,
          "",
        ].join("\n"),
      );
    },
  );

  it.each([
    ["Linux", "ppc64le"],
    ["Linux", "i686"],
    ["Darwin", "arm64"],
  ])("refuses to provision on unsupported %s %s", (system, machine) => {
    const result = runOnHost(system, machine, []);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain(
      "pinned binaries support Linux x86_64 and Linux aarch64",
    );
    expect(result.stdout).toBe("");
  });

  it.each([["--install"], ["--verify --plan"], ["--plan extra"]])(
    "rejects the unsupported invocation %s",
    (invocation) => {
      const result = runInWorkingDirectory(workspace, invocation.split(" "));

      expect(result.status).toBe(2);
      expect(result.stderr).toContain(
        "unsupported arguments; usage: setup-ci-tools.sh [--verify|--plan]",
      );
      expect(result.stdout).toBe("");
    },
  );

  it("provisions checksum-verified tools on this host and reports the pins", () => {
    const directory = contractWorkspace(() => {});

    const install = runInWorkingDirectory(directory, []);
    expect(install.status, install.stderr).toBe(0);

    const verify = runInWorkingDirectory(directory, ["--verify"]);
    expect(verify.status, verify.stderr).toBe(0);
    expect(verify.stdout).toBe(
      `actionlint ${contract.actionlint.version}, shellcheck ${contract.shellcheck.version}\n`,
    );
    expect(
      execFileSync(
        path.join(directory, ".tools/bin/shellcheck"),
        ["--version"],
        {
          encoding: "utf8",
        },
      ),
    ).toContain(`version: ${contract.shellcheck.version}`);
  }, 180_000);

  it("installs nothing when a pinned digest does not match the upstream archive", () => {
    const directory = contractWorkspace((parsed) => {
      // The tampered document is deliberately written back unvalidated, so this
      // narrows the parsed JSON rather than reusing the contract schema.
      const actionlint = parsed.actionlint as {
        sha256: Record<string, string>;
      };
      for (const platform of Object.keys(actionlint.sha256))
        actionlint.sha256[platform] = "0".repeat(64);
    });

    const result = runInWorkingDirectory(directory, []);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "actionlint archive checksum mismatch; verify ci-tools.json against the upstream release",
    );
    expect(existsSync(path.join(directory, ".tools/bin/actionlint"))).toBe(
      false,
    );
    expect(existsSync(path.join(directory, ".tools/bin/shellcheck"))).toBe(
      false,
    );
  }, 180_000);
});

describe("just installer boundary", () => {
  it("downloads, verifies, and installs just into a caller-owned bin directory", () => {
    const binDirectory = temporaryDirectory("just-bin.");
    const result = spawnSync(installJustScript, [], {
      cwd: workspace,
      encoding: "utf8",
      env: { ...process.env, XDG_BIN_HOME: binDirectory },
    });

    expect(result.status, result.stderr).toBe(0);
    expect(existsSync(path.join(binDirectory, "just"))).toBe(true);
  }, 60_000);

  // The destination comes from the environment, so it is constrained before the
  // script creates a directory or writes an executable into it.
  it.each([
    ["a relative destination", "relative/bin"],
    ["a destination that climbs out of the named directory", "/tmp/../etc/bin"],
  ])("installs nothing for %s", (_, destination) => {
    const result = spawnSync(installJustScript, [], {
      cwd: workspace,
      encoding: "utf8",
      env: { ...process.env, XDG_BIN_HOME: destination },
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain(
      "must be an absolute path with no '..' segment",
    );
    expect(existsSync(path.resolve(workspace, destination))).toBe(false);
  });

  it("reports how to recover when the destination cannot be created", () => {
    const parent = temporaryDirectory("just-unwritable.");
    const file = path.join(parent, "not-a-directory");
    writeFileSync(file, "occupied");
    const result = spawnSync(installJustScript, [], {
      cwd: workspace,
      encoding: "utf8",
      env: { ...process.env, XDG_BIN_HOME: path.join(file, "bin") },
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "set XDG_BIN_HOME to a writable directory and retry",
    );
  });
});

describe("ci-tools.json contract validation", () => {
  it.each([
    [
      "a malformed document",
      "{ not json",
      "ci-tools.json failed contract validation",
    ],
    [
      // The schema 2 shape carried a single amd64-only digest per tool.
      "the previous single-platform schema",
      JSON.stringify({
        schema: 2,
        actionlint: {
          version: contract.actionlint.version,
          sha256: contract.actionlint.sha256.x86_64,
        },
        shellcheck: {
          version: contract.shellcheck.version,
          sha256: contract.shellcheck.sha256.x86_64,
        },
        codex: JSON.parse(readFileSync(contractPath, "utf8")).codex,
      }),
      "restore ci-tools.json schema 3",
    ],
    [
      "a tool missing a supported platform digest",
      JSON.stringify({
        ...JSON.parse(readFileSync(contractPath, "utf8")),
        shellcheck: {
          version: contract.shellcheck.version,
          sha256: { x86_64: contract.shellcheck.sha256.x86_64 },
        },
      }),
      "invalid shellcheck contract; pin a sha256 for exactly these platforms",
    ],
    [
      "an unpinned codex release",
      JSON.stringify({
        ...JSON.parse(readFileSync(contractPath, "utf8")),
        codex: { package: "@openai/codex", version: "0.145.0", integrity: "" },
      }),
      "invalid codex contract",
    ],
  ])("rejects %s", (_, document, message) => {
    const directory = temporaryDirectory("ci-tools-invalid.");
    writeFileSync(path.join(directory, "ci-tools.json"), document);

    const result = runInWorkingDirectory(directory, ["--verify"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(message);
    expect(result.stdout).toBe("");
  });
});
