import { existsSync, readFileSync } from "node:fs";
import { publishableApps } from "../libs/build-config/src/publish-fragment.ts";

// Turn `nx show projects --affected --with-target build --json` (a JSON array of
// project names on stdin) into the `publish` matrix of .github/workflows/pages.yml.
// Only the shell and the federated remotes publish a subtree to the content
// store, so affected libraries are dropped here rather than in workflow YAML —
// libs/build-config/src/publish-fragment.ts stays the one list of lanes.
//
// `--all` ignores stdin and selects every lane. That is what a manual
// workflow_dispatch uses to seed a content store that has never held a full set
// of fragments, because compose refuses to assemble a partial site.
//
// llmlint: ignore-file[changed_behavior_has_e2e] This selection CLI has no browser interface: it emits a GitHub Actions matrix and never renders anything, so its success and failure paths are only observable as stdout and an exit status. publish-lanes.spec.ts drives this exact command as a real subprocess through affected selection, the --all seed, the empty selection, and the invalid-input exit; the bytes the lanes it selects go on to publish are driven through the browser by site.spec.ts and every feature journey.
process.on("uncaughtException", (error) => {
  console.error(
    `publishable-apps: ${error instanceof Error ? error.message : String(error)}; verify the Nx affected selection, then recompute the publish matrix`,
  );
  process.exit(1);
});

// argv is a boundary like stdin: accept exactly the one documented flag and
// reject anything else, so a typo can never be read as "publish nothing".
const flags = process.argv.slice(2);
if (flags.some((flag) => flag !== "--all") || flags.length > 1)
  throw new Error(
    `the only accepted argument is --all; received ${JSON.stringify(flags)}`,
  );
const selectAll = flags[0] === "--all";
const input = selectAll ? "" : readFileSync(0, "utf8").trim();
const names = input === "" ? [] : JSON.parse(input);
if (
  !Array.isArray(names) ||
  !names.every(
    (name) => typeof name === "string" && /^[a-z][a-z0-9-]*$/.test(name),
  )
)
  throw new Error(
    "expected a JSON array of Nx project names from `nx show projects --affected --with-target build --json`",
  );

const selected = selectAll
  ? [...publishableApps]
  : [...new Set(names)].filter((name) => publishableApps.includes(name));
for (const name of selected) {
  if (!existsSync(`apps/${name}/project.json`))
    throw new Error(
      `publishable app ${name} has no apps/${name}/project.json; every publish lane builds one workspace app`,
    );
}

process.stdout.write(`${JSON.stringify(selected.sort())}\n`);
