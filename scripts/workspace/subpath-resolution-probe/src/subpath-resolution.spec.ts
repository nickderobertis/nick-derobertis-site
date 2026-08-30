import { describe, expect, it } from "vitest";
import { overlappingSpecifiers } from "../../published-subpaths";

/**
 * The half of the subpath resolution contract only the test runner can answer,
 * run under a config the shared harness produced so that what resolves here is
 * what resolves when any app or library runs its own tests.
 *
 * `scripts/workspace/subpath-resolution.spec.ts` owns the contract and drives
 * this file as a real Vitest run; it belongs to no project's own suite. Every
 * subject below is imported for real, because the failure this rules out is a
 * specifier that resolves to a file other than the one its package publishes
 * for it, which no reading of a configuration object reports.
 *
 * Its subjects come from `scripts/workspace/published-subpaths.ts`, the one
 * derivation the build half reads too, so neither half can drift into asking
 * about a different set of published subpaths than the other.
 *
 * Two roots are in play and they are not the same one: that derivation reads
 * the manifests from the workspace root, which is where this run's Vitest root
 * and working directory both sit, while a relative `import()` is resolved
 * against this file. So a target is carried as a workspace-relative path and
 * prefixed only where it is imported.
 */

/** Where the workspace root sits relative to this file. */
const toWorkspaceRoot = "../../../..";

/**
 * The specifier the config beside this file states as a remote even though
 * `@site/build-config` publishes it too. It is the one subject whose answer is
 * not its package's target, so the sweep below leaves it to the reading that
 * owns it.
 */
const shadowedByARemote = "@site/build-config/remote-registry";

/** The federation specifier that config states, which no manifest publishes. */
const federated = "homeCards/Skeleton";

describe("the workspace test runner resolves published subpaths", () => {
  it("answers every longer specifier with its own target, not the shorter one's", async () => {
    const subjects = overlappingSpecifiers().filter(
      (subject) => subject.specifier !== shadowedByARemote,
    );
    expect(
      subjects.length,
      "no @site package publishes a subpath beside its bare specifier, so no overlapping specifier was resolved; confirm the workspace still publishes the subpath exports this contract reads",
    ).toBeGreaterThan(0);
    const findings: string[] = [];
    for (const subject of subjects) {
      const remedy = `a specifier that begins with ${subject.shorter} is being answered by ${subject.shorter} itself, so give the test runner a resolution that reads the package's exports map rather than matching specifiers by prefix`;
      // A prefix match claims the whole path below the shorter specifier, so
      // it reaches this either as a module that is not the published target or
      // as no module at all. Both are the same finding, and the second arrives
      // as a throw rather than as a value.
      let viaSpecifier: unknown;
      try {
        viaSpecifier = await import(subject.specifier);
      } catch (error) {
        findings.push(
          `Vitest could not resolve ${subject.specifier}, which its package publishes as ${subject.target}: ${error instanceof Error ? error.message : String(error)}; ${remedy}`,
        );
        continue;
      }
      const viaTarget: unknown = await import(
        `${toWorkspaceRoot}/${subject.target}`
      );
      if (viaSpecifier !== viaTarget)
        findings.push(
          `Vitest answered ${subject.specifier} with a module other than ${subject.target}, which its package publishes for it; ${remedy}`,
        );
    }
    expect(findings).toEqual([]);
  });
});

describe("the workspace test runner resolves the remotes a caller states", () => {
  it("answers a federation specifier no manifest publishes", async () => {
    // Nothing but the merged `remotes` map can answer this one, so resolving it
    // at all is what says the merge survived into the configuration the runner
    // actually resolves through.
    const stood: Record<string, unknown> = await import(federated);
    expect(stood.standsInForARemote).toBe(true);
  });

  it("answers with the remote where a package publishes the same specifier", async () => {
    const shadowed: Record<string, unknown> = await import(shadowedByARemote);
    expect(shadowed.shadowsAPublishedSubpath).toBe(true);
    // The package's own module is what would answer without the merge, so its
    // export standing here would mean the remote lost.
    expect(shadowed.validatedRemoteRegistry).toBeUndefined();
  });
});
