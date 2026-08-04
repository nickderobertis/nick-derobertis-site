import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { beforeAll, describe, expect, test } from "vitest";

// The content-store branch, its deploy-lane checkout, and a publish lane's
// scratch repository are named in files that cannot import each other, so
// libs/build-config/src/publish-fragment.ts is the one source and
// `just lint-workflows` is the gate that holds every restatement to it. That
// gate is the only interface these tests use — it reports the names it enforced,
// and each case then moves one restatement in the committed tree exactly as a
// rename would, runs the real recipe, and restores the file. Because a drifted
// restatement is briefly the committed tree, tooling-publish's test target
// declares `parallelism: false`: another project's gate reading one of these
// files mid-case would otherwise see this file's edit as its own failure.

const workflow = ".github/workflows/pages.yml";

function lintWorkflows() {
  return spawnSync("just", ["lint-workflows"], { encoding: "utf8" });
}

function lintWithDrift(file: string, from: string, to: string) {
  const original = readFileSync(file, "utf8");
  try {
    expect(original).toContain(from);
    writeFileSync(file, original.replace(from, to));
    return lintWorkflows();
  } finally {
    writeFileSync(file, original);
  }
}

let contract: {
  branch: string;
  checkout: string;
  appRoot: string;
  workdir: string;
};

describe("content-store contract", () => {
  beforeAll(() => {
    const result = lintWorkflows();
    expect(result.status, result.stderr).toBe(0);
    const reported =
      /content-store contract agrees: branch (\S+), checkout (\S+), app root (\S+), lane workdir (\S+)/.exec(
        result.stdout,
      );
    const [, branch, checkout, appRoot, workdir] = reported ?? [];
    if (!branch || !checkout || !appRoot || !workdir)
      throw new Error(
        "just lint-workflows did not report the content-store contract it enforced",
      );
    contract = { branch, checkout, appRoot, workdir };
  }, 180_000);

  test("the gate enforces the names the publish lane actually uses", () => {
    expect(contract.branch).toBe("published-fragments");
    expect(contract.checkout).toBe(".content-store");
    expect(contract.appRoot).toBe("apps");
    expect(contract.workdir).toBe(".publish-store");
  });

  test("a workflow publishing to a different branch than the lane fails the gate", () => {
    const result = lintWithDrift(
      workflow,
      `CONTENT_STORE_BRANCH: ${contract.branch}`,
      "CONTENT_STORE_BRANCH: renamed-fragments",
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(
      /sets CONTENT_STORE_BRANCH to "renamed-fragments" but the content store is/,
    );
  }, 180_000);

  test("a deploy lane composing from a path it never checked out fails the gate", () => {
    const result = lintWithDrift(
      workflow,
      `just compose ${contract.checkout}/${contract.appRoot} `,
      "just compose .elsewhere/apps ",
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      `does not compose from ${contract.checkout}/${contract.appRoot}`,
    );
  }, 180_000);

  test("a working copy that is no longer ignored fails the gate", () => {
    const result = lintWithDrift(
      ".gitignore",
      `${contract.workdir}/`,
      "unrelated-scratch/",
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      `does not ignore the ${contract.workdir}/ working copy`,
    );
  }, 180_000);

  test("a document that stops naming the branch fails the gate", () => {
    const result = lintWithDrift(
      "README.md",
      contract.branch,
      "some-other-branch",
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(
      /README\.md describes the deploy split without naming/,
    );
  }, 180_000);

  test("every drift case leaves the committed restatements as it found them", () => {
    expect(readFileSync(workflow, "utf8")).toContain(
      `CONTENT_STORE_BRANCH: ${contract.branch}`,
    );
    expect(readFileSync(".gitignore", "utf8")).toContain(
      `${contract.workdir}/`,
    );
    expect(readFileSync("README.md", "utf8")).toContain(contract.branch);
  });
});
