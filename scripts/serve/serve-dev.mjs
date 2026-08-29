import { spawn } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { holdArtifactRoot } from "@site/artifact-contracts/artifact-hold";

// The development server: one named app built from source with hot module
// replacement, every other app served from the composed artifact's built
// output, both answering on one origin at the site's own base path.
//
// Serving both halves from one origin is what leaves a production build alone.
// The remote URLs `libs/build-config/src/rspack-remote.ts` emits are
// origin-relative — `/<pages base>/remotes/<remote>/remoteEntry.js` — so they
// resolve against this server exactly as they resolve against Pages. Nothing
// overrides where a container resolves; what this decides is which of the two
// answers for it, and `libs/build-config/src/rspack-dev.ts` owns that split.
//
// llmlint: ignore-file[changed_behavior_has_e2e] This CLI validates its app, claims the artifact it serves, and hands the serving itself to the real Nx dev-server target; every path it owns is an exit status and a diagnostic before anything is listening. serve-dev.spec.ts drives this exact recipe as a real subprocess and drives the page it serves, and the live update it serves, through a real browser.
process.on("uncaughtException", (error) => {
  console.error(
    `serve-dev: ${error instanceof Error ? error.message : String(error)}; fix what that names, then run just serve-dev <app> again`,
  );
  process.exit(1);
});

const artifactRoot = fileURLToPath(
  new URL("../../dist/apps/shell", import.meta.url),
);

/**
 * Every app this workspace can serve from source, read from the apps'
 * own declarations rather than listed here: an app is servable exactly when it
 * declares the dev-server target this command runs, so one added tomorrow is
 * servable the day it declares that target.
 */
function servableApps() {
  const apps = readdirSync("apps", { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => {
      let project;
      try {
        project = JSON.parse(readFileSync(`apps/${name}/project.json`, "utf8"));
      } catch {
        return false;
      }
      return Boolean(project?.targets?.serve);
    })
    .sort();
  if (apps.length === 0)
    throw new Error(
      "no app under apps/ declares a serve target, so there is nothing a development server could build from source",
    );
  return apps;
}

/**
 * The app named on the command line, or an exit naming every app that could
 * have been named. argv is a boundary: this name becomes an Nx target, so a
 * typo is refused here rather than reaching Nx as a project it cannot resolve.
 */
function validatedApp(name, apps) {
  if (typeof name !== "string" || !apps.includes(name)) {
    console.error(
      `serve-dev: ${JSON.stringify(name ?? null)} is not an app this workspace serves from source, one of ${JSON.stringify(apps)}. Name one of those and rerun just serve-dev <app>`,
    );
    process.exit(2);
  }
  return name;
}

const argv = process.argv.slice(2);
const [flag, named, ...surplus] = argv;
if (
  surplus.length > 0 ||
  (flag === "--app" ? typeof named !== "string" : named !== undefined)
)
  throw new Error(
    `the only accepted arguments are <app> and --app <app>; received ${JSON.stringify(argv)}`,
  );

const apps = servableApps();
if (flag === "--app") {
  process.stdout.write(`${validatedApp(named, apps)}\n`);
  process.exit(0);
}
const app = validatedApp(flag, apps);

// The port is this command's one environment input, and it reaches Nx as a
// command-line argument, so it is held to a port before it is passed on.
const portValue = process.env.PORT;
if (portValue !== undefined) {
  const port = Number(portValue);
  if (!Number.isInteger(port) || port < 1 || port > 65_535)
    throw new Error(
      `PORT must be an integer from 1 to 65535; received ${JSON.stringify(portValue)}. Set a valid PORT and run just serve-dev ${app} again`,
    );
}

// Every app but the one under development is answered for out of this tree, and
// a compose replaces it in place, so a gate composing it beside this server
// would answer a developer's reload out of half of two compositions. Claiming
// it as a reader is what makes that compose refuse instead.
const release = (() => {
  try {
    return holdArtifactRoot(artifactRoot, "serving");
  } catch (error) {
    console.error(
      `serve-dev: could not claim ${artifactRoot} for the development server: ${error instanceof Error ? error.message : String(error)} Nothing was served; clear what that names, then run just serve-dev ${app} again`,
    );
    return process.exit(1);
  }
})();
process.on("exit", release);

// NODE_ENV decides whether the app's own build configuration takes its
// development overrides, so it is set here rather than left to the executor's
// default: an ambient production NODE_ENV would otherwise leave this server
// building production output it could not hot-update.
const server = spawn(
  "pnpm",
  [
    "exec",
    "nx",
    "run",
    `${app}:serve`,
    ...(portValue === undefined ? [] : [`--port=${portValue}`]),
  ],
  { env: { ...process.env, NODE_ENV: "development" }, stdio: "inherit" },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => server.kill(signal));
server.on("exit", (code, signal) => {
  process.exitCode = signal === null ? (code ?? 0) : 0;
});
