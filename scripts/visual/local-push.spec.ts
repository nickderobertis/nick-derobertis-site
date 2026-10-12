import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";
import { z } from "zod";

// Git itself owns hook dispatch here: this repository has no hook manager or
// installer. Existing clones retain core.hooksPath after the tracked hook is
// deleted. Drive that real configuration without check-command doubles.
test("ordinary local pushes stay check-free with the former hooksPath", () => {
  const scratch = z
    .string()
    .refine((value) => path.isAbsolute(value) && statSync(value).isDirectory())
    .parse(process.env.ONEPIPELINE_NODE_SCRATCH_DIR ?? process.cwd());
  const root = mkdtempSync(path.join(scratch, "local-push-"));
  const clone = path.join(root, "clone");
  const remote = path.join(root, "remote.git");
  const trace = path.join(root, "git-trace.json");
  const git = (...args: string[]) =>
    execFileSync("git", args, {
      cwd: clone,
      encoding: "utf8",
      env: {
        PATH: "/usr/bin:/bin",
        HOME: root,
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_TRACE2_EVENT: trace,
      },
    }).trim();
  try {
    mkdirSync(clone);
    git("init", "--initial-branch=master");
    git("config", "user.name", "Local push test");
    git("config", "user.email", "local-push@example.invalid");
    git("config", "core.hooksPath", ".githooks");
    git("init", "--bare", remote);
    git("remote", "add", "origin", remote);
    expect(existsSync(".githooks/pre-push")).toBe(false);
    const baseline = "apps/awards/visual/baseline/x86_64.json";
    const gallery = "gallery/index.html";
    mkdirSync(path.join(clone, path.dirname(baseline)), { recursive: true });
    mkdirSync(path.join(clone, "gallery"));
    writeFileSync(path.join(clone, baseline), readFileSync(baseline));
    writeFileSync(path.join(clone, gallery), "unchanged gallery\n");
    const artifacts = [baseline, gallery].map((file) =>
      readFileSync(path.join(clone, file), "utf8"),
    );
    git("add", ".");
    git("commit", "-m", "test: seed local artifacts");
    const push = () => {
      git("push", "origin", "master");
      expect(git("--git-dir", remote, "rev-parse", "refs/heads/master")).toBe(
        git("rev-parse", "HEAD"),
      );
      expect(git("status", "--porcelain")).toBe("");
      expect(
        [baseline, gallery].map((file) =>
          readFileSync(path.join(clone, file), "utf8"),
        ),
      ).toEqual(artifacts);
    };
    push();
    writeFileSync(path.join(clone, "apps/awards/page.tsx"), "export {};\n");
    git("add", ".");
    git("commit", "-m", "test: change screenshot-relevant source");
    push();
    push();
    // Rerunning setup must not restore hook activation. Expand the actual
    // recipe rather than installing unrelated tools into the test clone.
    for (let rerun = 0; rerun < 2; rerun++) {
      const setup = spawnSync("just", ["--dry-run", "bootstrap"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      expect(setup.status).toBe(0);
      expect(setup.stderr).toContain("pnpm install");
      expect(setup.stdout + setup.stderr).not.toMatch(
        /hooksPath|hook-install|pre-push/,
      );
      expect(git("config", "--get", "core.hooksPath")).toBe(".githooks");
      push();
    }
    const traceEvent = z.object({
      event: z.string(),
      argv: z.array(z.string()).optional(),
    });
    const events = readFileSync(trace, "utf8")
      .trim()
      .split("\n")
      .map((line) => traceEvent.parse(JSON.parse(line)));
    const children = events.filter((event) => event.event === "child_start");
    expect(children.length).toBeGreaterThan(0);
    expect(
      children.some((event) => event.argv?.join(" ").includes("receive-pack")),
    ).toBe(true);
    expect(
      children.map((event) => event.argv?.join(" ")).join("\n"),
    ).not.toMatch(/pre-push|llmlint|screencomp|docker|capture|baseline/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
