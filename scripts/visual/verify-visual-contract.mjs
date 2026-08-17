import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// llmlint: ignore-file[changed_behavior_has_e2e] This CLI/filesystem quality-gate validator has no browser interface; lint-workflows executes its real boundary against committed workflow, configuration, baselines, and documentation.

process.on("uncaughtException", (error) => {
  console.error(
    `verify-visual-contract: ${error instanceof Error ? error.message : String(error)}; update visual-tools.json and every visual consumer together`,
  );
  process.exit(1);
});

const contract = JSON.parse(readFileSync("visual-tools.json", "utf8"));
const contractKeys = [
  "architecture",
  "pagesRepository",
  "playwrightContainer",
  "screencompVersion",
];
if (
  typeof contract !== "object" ||
  contract === null ||
  Object.keys(contract).length !== contractKeys.length ||
  !Object.keys(contract).every((key) => contractKeys.includes(key)) ||
  !contractKeys.every(
    (key) => typeof contract[key] === "string" && contract[key].length > 0,
  ) ||
  !/^[a-z0-9_]+$/.test(contract.architecture)
)
  throw new Error(
    "visual-tools.json must contain non-empty architecture, pagesRepository, playwrightContainer, and screencompVersion strings",
  );

// Visual regression is screencomp's canonical reusable workflow now, so the pins
// live in a few named consumers. Every value in visual-tools.json must appear in
// exactly its declared consumers — no more, no less — so a bump can never land in
// one file and drift in another (e.g. the reusable-workflow ref, the installed
// CLI, and the capture container must all move together).
const sources = [
  ["workflow", readFileSync(".github/workflows/visual-docs.yml", "utf8")],
  ["bootstrap", readFileSync("justfile", "utf8")],
  ["repository instructions", readFileSync("AGENTS.md", "utf8")],
  ["pre-push guard", readFileSync(".githooks/pre-push", "utf8")],
  ["screencomp config", readFileSync("screencomp.toml", "utf8")],
  [
    "affected selector",
    readFileSync("scripts/visual/affected-visual-projects.mjs", "utf8"),
  ],
];
const visualProjectNames = readdirSync("apps")
  .filter((project) => {
    const configPath = `apps/${project}/project.json`;
    return (
      statSync(`apps/${project}`).isDirectory() &&
      readFileSync(configPath, "utf8").includes('"screenshot"')
    );
  })
  .sort();
for (const project of visualProjectNames)
  sources.push([
    `${project} screenshot target`,
    readFileSync(`apps/${project}/project.json`, "utf8"),
  ]);
const captureSource = readFileSync("libs/visual-harness/src/index.ts", "utf8");
const nxConfig = JSON.parse(readFileSync("nx.json", "utf8"));
if (
  typeof nxConfig !== "object" ||
  nxConfig === null ||
  Array.isArray(nxConfig) ||
  typeof nxConfig.targetDefaults !== "object" ||
  nxConfig.targetDefaults === null
)
  throw new Error("nx.json must contain an object-valued targetDefaults");
const homeRspackSource = readFileSync("apps/home/rspack.config.ts", "utf8");
const remoteMapMatch = homeRspackSource.match(/remoteMap\(\[([\s\S]*?)\]\)/);
if (!remoteMapMatch)
  throw new Error(
    "Home composition must declare its remotes through remoteMap",
  );
let remoteManifest;
try {
  remoteManifest = JSON.parse(
    readFileSync("libs/build-config/src/remotes.json", "utf8"),
  );
} catch (error) {
  throw new Error(
    `libs/build-config/src/remotes.json is not readable JSON (${error.message}); restore it to an object mapping each remote's project name to its federation alias, then rerun just lint-workflows`,
  );
}
if (
  !remoteManifest ||
  typeof remoteManifest !== "object" ||
  Array.isArray(remoteManifest) ||
  Object.values(remoteManifest).some((alias) => typeof alias !== "string")
)
  throw new Error(
    "libs/build-config/src/remotes.json must be an object mapping each remote's project name to its federation alias string; restore that shape, then rerun just lint-workflows",
  );
// Which remotes a screenshot depends on is no longer written down here to be
// compared against: scripts/workspace/federation-plugin.mjs derives every
// screenshot's build dependencies from the remotes themselves, and
// federation-contract.spec.ts holds that derivation to the registry against the
// resolved project graph, which is where the dependency now exists.
if (nxConfig.targetDefaults?.screenshot?.cache !== false)
  throw new Error(
    "Nx screenshot target must not cache: its output path depends on SHOTS_OUT, and the reusable workflow re-runs it into a second tree for the reproducibility gate",
  );
const visualProjects = readdirSync("apps")
  .filter((project) => {
    if (!statSync(`apps/${project}`).isDirectory()) return false;
    const projectConfig = JSON.parse(
      readFileSync(`apps/${project}/project.json`, "utf8"),
    );
    if (
      typeof projectConfig !== "object" ||
      projectConfig === null ||
      Array.isArray(projectConfig) ||
      typeof projectConfig.targets !== "object" ||
      projectConfig.targets === null
    )
      throw new Error(`Invalid Nx project configuration for ${project}`);
    return Boolean(projectConfig.targets?.screenshot);
  })
  .sort();
const screencompSource = readFileSync("screencomp.toml", "utf8");
const stateToggle = screencompSource.match(
  /key = "state"[\s\S]*?values = \[([^\]]+)\]/,
);
if (!stateToggle) throw new Error("screencomp.toml has no state toggle values");
const toggleStates = new Set(
  [...stateToggle[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]),
);
for (const project of visualProjects) {
  const projectConfig = JSON.parse(
    readFileSync(`apps/${project}/project.json`, "utf8"),
  );
  if (
    typeof projectConfig !== "object" ||
    projectConfig === null ||
    Array.isArray(projectConfig) ||
    typeof projectConfig.targets !== "object" ||
    projectConfig.targets === null
  )
    throw new Error(`Invalid Nx project configuration for ${project}`);
  if (
    !projectConfig.targets.screenshot.options?.command?.includes(
      `apps/${project}/visual/capture.ts`,
    )
  )
    throw new Error(
      `Visual project ${project} screenshot target must run its app-owned capture.ts`,
    );
  let suite;
  try {
    ({ suite } = await import(
      pathToFileURL(path.resolve(`apps/${project}/visual/scenarios.ts`))
    ));
  } catch (error) {
    throw new Error(
      `Visual project ${project} has no readable scenarios.ts (${error.message})`,
    );
  }
  if (
    suite?.project !== project ||
    typeof suite.hostPath !== "string" ||
    !Array.isArray(suite.scenarios)
  )
    throw new Error(`Invalid visual suite for ${project}`);
  for (const scenario of suite.scenarios)
    if (!toggleStates.has(scenario.state))
      throw new Error(
        `Visual scenario state ${scenario.state} is missing from screencomp.toml's state toggle values`,
      );
  const baseline = JSON.parse(
    readFileSync(
      `apps/${project}/visual/baseline/${contract.architecture}.json`,
      "utf8",
    ),
  );
  if (
    typeof baseline !== "object" ||
    baseline === null ||
    !Array.isArray(baseline.shots) ||
    !baseline.shots.every(
      (shot) =>
        typeof shot === "object" &&
        shot !== null &&
        typeof shot.toggles === "object" &&
        shot.toggles !== null &&
        typeof shot.toggles.state === "string",
    )
  )
    throw new Error(
      `Visual project ${project} has an invalid baseline manifest`,
    );
  const baselineStates = new Set(
    baseline.shots.map((shot) => shot.toggles?.state),
  );
  for (const state of new Set(
    suite.scenarios.map((scenario) => scenario.state),
  ))
    if (!baselineStates.has(state))
      throw new Error(`Visual project ${project} baseline is missing ${state}`);
}
const expectedConsumers = {
  architecture: [
    "workflow",
    "repository instructions",
    "screencomp config",
    "affected selector",
    "pre-push guard",
    ...visualProjectNames.map((project) => `${project} screenshot target`),
  ],
  pagesRepository: ["workflow"],
  playwrightContainer: ["workflow", "pre-push guard"],
  screencompVersion: ["workflow", "bootstrap", "repository instructions"],
};
for (const [key, value] of Object.entries(contract)) {
  const matches = sources
    .filter(([, source]) => source.includes(value))
    .map(([name]) => name);
  if (
    matches.length !== expectedConsumers[key].length ||
    !matches.every((name) => expectedConsumers[key].includes(name))
  )
    throw new Error(
      `Visual contract ${key}=${value} is consumed by [${matches.join(", ")}], expected [${expectedConsumers[key].join(", ")}]; update visual-tools.json and every visual consumer together`,
    );
}
if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(contract.pagesRepository))
  throw new Error(
    "Visual pagesRepository must be an owner/name; correct pagesRepository in visual-tools.json and rerun just lint-workflows",
  );
// screencomp's visual-docs action deploys canonical galleries to
// <project>/<arch> and pull-request previews to pr-<number>/<project>/<arch>.
// It never writes a root index, so documenting the bare Pages root advertises a
// permanent 404. Both URL forms are derived from visual-tools.json here so the
// docs cannot drift from the deployed layout or from an architecture bump.
const [pagesOwner, pagesName] = contract.pagesRepository.split("/");
const pagesRoot = `https://${pagesOwner}.github.io/${pagesName}`;
const galleryUrls = [
  `${pagesRoot}/<project>/${contract.architecture}/`,
  `${pagesRoot}/pr-<number>/<project>/${contract.architecture}/`,
];
// Every mention of the site must therefore continue into a project or pr-<number>
// segment; anything else — with or without a trailing slash — is the bare root.
const bareRoot = new RegExp(
  `${pagesRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?!/[A-Za-z0-9<])`,
);
for (const path of ["AGENTS.md", "README.md", "docs/integration-proof.md"]) {
  const documentation = readFileSync(path, "utf8");
  for (const url of galleryUrls)
    if (!documentation.includes(url))
      throw new Error(
        `Visual gallery documentation in ${path} must document ${url}`,
      );
  if (bareRoot.test(documentation))
    throw new Error(
      `Visual gallery documentation in ${path} advertises the bare ${pagesRoot} Pages root, which screencomp never deploys; document the per-project gallery URLs instead`,
    );
}
for (const state of [
  "happy",
  "all",
  "empty",
  "loading",
  "error",
  "expanded",
  "employment-only",
]) {
  if (!screencompSource.includes(`"${state}"`))
    throw new Error(
      `Visual state ${state} is missing from screencomp.toml; update the capture and toggle contracts together`,
    );
}
for (const toggle of ["render", "state", "viewport"]) {
  if (!captureSource.includes(`${toggle}:`))
    throw new Error(
      `Capture metadata is missing the ${toggle} toggle required by screencomp.toml`,
    );
}
for (const value of [
  "desktop",
  "tablet",
  "mobile",
  "standalone",
  "host-composed",
]) {
  if (!screencompSource.includes(`"${value}"`))
    throw new Error(
      `Visual toggle value ${value} is missing from screencomp.toml`,
    );
}
console.log(
  "visual tool contract matches workflow, pre-push guard, and screencomp config",
);
