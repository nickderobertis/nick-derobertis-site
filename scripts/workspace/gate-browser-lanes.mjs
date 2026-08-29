import { readFileSync } from "node:fs";
import { declaredAppProjects } from "./federation-registry.mjs";

// Turn `nx show projects --affected --json` (a JSON array of project names on
// stdin) into the project selection `just check` dispatches its browser and
// visual targets for: one `nx run-many -t e2e,screenshot -p <this selection>`.
//
// Two facts decide a lane, and both are read out of the apps' own project.json
// files rather than restated here. A project is a lane when the affected
// selection reached it and it owns a browser or a visual suite. And the project
// that composes the served artifact — the one owning `prerender` — is a lane on
// every push whether the affected selection reached it or not, because affected
// selection must never be the only gate for the composed artifact.
//
// That second fact is why this exists. `e2e` is `cache: false`, and the shell
// owns the workspace-wide `eslint .` run, so Nx marks it affected for nearly any
// TypeScript change: a gate that ran the affected batch and then ran the
// composed host's suite again unconditionally ran the heaviest suite in the
// repository twice on almost every commit. Unioning the two selections here,
// before anything is dispatched, is what makes it exactly once either way.
//
// llmlint: ignore-file[changed_behavior_has_e2e] This selection CLI has no browser interface: it prints a project list and an exit status, and every suite it selects is itself a real-browser suite that Nx runs afterwards. gate-browser-lanes.spec.ts drives this exact command through `just` as a real subprocess over real push ranges — one reaching the composed host, one not, and one reaching nothing — and drives Nx's own task graph for the dispatch that selection produces.
process.on("uncaughtException", (error) => {
  console.error(
    `gate-browser-lanes: ${error instanceof Error ? error.message : String(error)}; verify the Nx affected selection, then recompute the gate's browser lanes`,
  );
  process.exit(1);
});

// argv is a boundary like stdin: this command takes the affected selection and
// nothing else, so an argument left on the command line is refused rather than
// quietly ignored while the wrong lanes are printed.
const surplus = process.argv.slice(2);
if (surplus.length > 0)
  throw new Error(
    `no arguments are accepted; the affected selection arrives on stdin, and ${JSON.stringify(surplus)} was passed`,
  );

const input = readFileSync(0, "utf8").trim();
const affected = input === "" ? [] : JSON.parse(input);
if (
  !Array.isArray(affected) ||
  !affected.every(
    (name) => typeof name === "string" && /^[a-z][a-z0-9-]*$/.test(name),
  )
)
  throw new Error(
    "expected a JSON array of Nx project names from `nx show projects --affected --json`",
  );

const apps = declaredAppProjects();
const suites = ["e2e", "screenshot"];
const composed = apps.filter((app) => app.targets.includes("prerender"));
if (composed.length === 0)
  throw new Error(
    "no app declares a prerender target, so nothing composes the served artifact and the gate has no unconditional lane. Declare prerender on the composing app and rerun just check",
  );
const uncomposed = composed.filter((app) => !app.targets.includes("e2e"));
if (uncomposed.length > 0)
  throw new Error(
    `${uncomposed.map((app) => app.name).join(", ")} composes the served artifact but declares no e2e target, so gating it on every push would dispatch nothing. Give the composing app a browser suite and rerun just check`,
  );

const reached = new Set(affected);
const lanes = apps
  .filter(
    (app) =>
      composed.includes(app) ||
      (reached.has(app.name) &&
        suites.some((suite) => app.targets.includes(suite))),
  )
  .map((app) => app.name)
  .sort();

process.stdout.write(`${lanes.join(",")}\n`);
