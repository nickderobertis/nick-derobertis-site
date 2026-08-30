import { readdirSync, readFileSync } from "node:fs";
import { z } from "zod";

/**
 * What this workspace publishes as a subpath beside the bare specifier that
 * subpath begins with, derived once from the manifests that publish it.
 *
 * Both halves of the subpath resolution contract are held to the same subjects
 * — `scripts/workspace/subpath-resolution.spec.ts` drives the production
 * build's resolver and `subpath-resolution-probe/src/subpath-resolution.spec.ts`
 * drives the test runner's — and the two run in separate processes under
 * separate configurations. Stating the manifest schema and this derivation in
 * each of them would leave the halves free to drift into asking about
 * different subjects, and a half asking about fewer of them still reports
 * green. So this is the one source both read.
 */

const packageName = z.string().regex(/^@site\/[a-z][a-z0-9-]*$/);

// Both halves of an exports map are read here: a key is the subpath a
// specifier asks for, and a value is the file the answer has to be.
const manifestSchema = z.object({
  name: packageName,
  exports: z
    .record(
      z.string().regex(/^\.(?:\/[\w.-]+)*$/),
      z.string().regex(/^\.\/[\w.-]+(?:\/[\w.-]+)*$/),
    )
    .optional(),
});

/**
 * A subpath a package publishes beside the bare specifier it begins with. Both
 * are carried, because the failure being ruled out is the longer one being
 * answered with the shorter one's target.
 */
export type Overlap = {
  /** The bare specifier the longer one begins with. */
  shorter: string;
  /** The file that shorter specifier publishes, which is the wrong answer. */
  shorterTarget: string;
  /** The longer specifier under test. */
  specifier: string;
  /** The file its package publishes for it, which is the only right answer. */
  target: string;
};

/** Every such subpath the workspace publishes, workspace-relative targets. */
export function overlappingSpecifiers(): Overlap[] {
  return ["apps", "libs", "scripts"].flatMap((tree) =>
    readdirSync(tree, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .flatMap((entry) => {
        const root = `${tree}/${entry.name}`;
        let document: string;
        try {
          document = readFileSync(`${root}/package.json`, "utf8");
        } catch {
          // A directory under a project tree with no manifest publishes
          // nothing; project-manifest.spec.ts is what holds every Nx project
          // to having one.
          return [];
        }
        const manifest = manifestSchema.parse(JSON.parse(document));
        const exported = manifest.exports ?? {};
        const bare = exported["."];
        if (bare === undefined) return [];
        return Object.entries(exported)
          .filter(([subpath]) => subpath !== ".")
          .map(([subpath, target]) => ({
            shorter: manifest.name,
            shorterTarget: `${root}/${bare.slice(2)}`,
            specifier: `${manifest.name}${subpath.slice(1)}`,
            target: `${root}/${target.slice(2)}`,
          }));
      }),
  );
}
