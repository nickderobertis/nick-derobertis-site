import { spawn } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { holdArtifactRoot } from "@site/artifact-contracts/artifact-hold";
import { composedArtifactRoot } from "@site/build-config/composed-artifact";

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

// The composed artifact, as an absolute path: this claims it as a reader while
// it serves, and a hold names the directory it is over. Which directory that is
// belongs to `@site/build-config/composed-artifact`, not to this command.
const artifactRoot = fileURLToPath(
  new URL(`../../${composedArtifactRoot}`, import.meta.url),
);

/**
 * The one executor that serves an app from source with hot module replacement,
 * which is what this command promises. A `serve` target running anything else
 * is some other command's, so it does not make its app servable here.
 */
const devServerExecutor = "@nx/rspack:dev-server";

/**
 * Whether one app's own declaration names the dev-server target this command
 * runs.
 *
 * A `project.json` is a boundary like argv, and a wider one: the answer here
 * decides both which names `validatedApp` accepts and which Nx target this
 * command then runs. So the parsed document is held to the Nx shape this reads
 * — an object, whose `targets` is an object, whose `serve` is a target
 * configuration running `devServerExecutor` — before any of it decides
 * anything. A directory holding no readable project.json is not an Nx project
 * at all and is simply not an app; a directory holding one that is not an Nx
 * project configuration is a declaration to fix, and says so.
 */
function declaresServeTarget(path) {
  let document;
  try {
    document = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return false;
  }
  // The rerun instruction is the uncaught handler's to add, so what is thrown
  // here is the reason alone: the declaration at fault and what is wrong with it.
  const reject = (reason) => {
    throw new Error(
      `${path} ${reason}, so this workspace's servable apps could not be read`,
    );
  };
  if (
    typeof document !== "object" ||
    document === null ||
    Array.isArray(document)
  )
    reject("is not an Nx project configuration object");
  const { targets } = document;
  if (targets === undefined) return false;
  if (typeof targets !== "object" || targets === null || Array.isArray(targets))
    reject("declares a targets that is not an object of Nx targets");
  const serve = targets.serve;
  if (serve === undefined) return false;
  if (typeof serve !== "object" || serve === null || Array.isArray(serve))
    reject("declares a serve target that is not an Nx target configuration");
  if (typeof serve.executor !== "string")
    reject("declares a serve target naming no executor to run it");
  return serve.executor === devServerExecutor;
}

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
    .filter((name) => declaresServeTarget(`apps/${name}/project.json`))
    .sort();
  if (apps.length === 0)
    throw new Error(
      `no app under apps/ declares a ${devServerExecutor} serve target, so there is nothing a development server could build from source`,
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
      `PORT must be an integer from 1 to 65535; received ${JSON.stringify(portValue)}`,
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
//
// llmlint: ignore[tool_output_is_signal] The dev server's stream is the signal a
// developer runs this for, so it is passed through rather than captured: what it
// prints is which compilation is running, which module was just hot-replaced,
// and the type and build errors as they happen, on a command that stays in the
// foreground until it is stopped. There is no success to be quiet about — the
// only output this could withhold is the output the recipe exists to show — and
// withholding it would leave a developer editing against a server whose last
// compile failed with nothing said. The paths this command owns are the ones
// above, and each of those is one diagnostic line and an exit status.
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
