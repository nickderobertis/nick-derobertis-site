import { existsSync, readFileSync } from "node:fs";

// Transform `nx show projects --affected --with-target screenshot --json`
// (a JSON array of project names on stdin) into the dynamic `projects` matrix
// consumed by screencomp's visual-docs-reusable.yml. Each affected app becomes
// one lane with a stable id, its own capture/verify roots beneath shots/, its
// committed per-app baseline manifest, and its own gallery title — so an
// unaffected app is never captured or classified (never reported as removed).
//
// Single source of truth for the arch: the reusable workflow reads
// [capture].arches from screencomp.toml; this repo maintains only x86_64, so the
// per-app manifest path is pinned to that committed baseline.
const ARCH = "x86_64";

process.on("uncaughtException", (error) => {
  console.error(
    `affected-visual-projects: ${error instanceof Error ? error.message : String(error)}; verify the Nx affected selection and per-app baselines, then recompute the projects matrix`,
  );
  process.exit(1);
});

const input = readFileSync(0, "utf8").trim();
const names = input === "" ? [] : JSON.parse(input);
if (
  !Array.isArray(names) ||
  !names.every(
    (name) => typeof name === "string" && /^[a-z][a-z0-9-]*$/.test(name),
  )
)
  throw new Error(
    "expected a JSON array of Nx project names from `nx show projects --affected --with-target screenshot --json`",
  );

const projects = [...new Set(names)].sort().map((id) => {
  if (!existsSync(`apps/${id}/project.json`))
    throw new Error(
      `affected project ${id} has no apps/${id}/project.json; only workspace apps expose a screenshot target`,
    );
  const projectConfig = JSON.parse(
    readFileSync(`apps/${id}/project.json`, "utf8"),
  );
  if (
    typeof projectConfig !== "object" ||
    projectConfig === null ||
    Array.isArray(projectConfig) ||
    typeof projectConfig.targets !== "object" ||
    projectConfig.targets === null ||
    !projectConfig.targets?.screenshot ||
    !existsSync(`apps/${id}/visual/scenarios.ts`)
  )
    throw new Error(
      `affected project ${id} must own an Nx screenshot target and visual/scenarios.ts`,
    );
  const manifest = `apps/${id}/visual/baseline/${ARCH}.json`;
  if (!existsSync(manifest))
    throw new Error(
      `affected project ${id} has no committed baseline ${manifest}; seed it with the pre-push guard before enabling its screenshot target`,
    );
  return {
    id,
    current: `shots/current/${id}`,
    verify: `shots/verify/${id}`,
    manifest,
    "gallery-title": id,
  };
});

process.stdout.write(`${JSON.stringify(projects)}\n`);
