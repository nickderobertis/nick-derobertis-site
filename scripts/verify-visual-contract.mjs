import { readFileSync } from "node:fs";

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
  )
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
    readFileSync("scripts/affected-visual-projects.mjs", "utf8"),
  ],
];
const captureSource = readFileSync("scripts/capture-visual.mjs", "utf8");
const nxConfig = JSON.parse(readFileSync("nx.json", "utf8"));
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
const composedProjects = Object.keys(remoteManifest).sort();
const screenshotBuildDependency =
  nxConfig.targetDefaults?.screenshot?.dependsOn?.find(
    (dependency) =>
      typeof dependency === "object" &&
      dependency !== null &&
      dependency.target === "build" &&
      Array.isArray(dependency.projects),
  );
if (
  !screenshotBuildDependency ||
  JSON.stringify([...screenshotBuildDependency.projects].sort()) !==
    JSON.stringify(composedProjects)
)
  throw new Error(
    "Nx screenshot build dependencies must include every remote consumed by full-shell fragment composition; add every remotes.json key to targetDefaults.screenshot.dependsOn projects in nx.json",
  );
if (nxConfig.targetDefaults?.screenshot?.cache !== false)
  throw new Error(
    "Nx screenshot target must not cache: its output path depends on SHOTS_OUT, and the reusable workflow re-runs it into a second tree for the reproducibility gate",
  );
const visualProjects = JSON.parse(readFileSync("visual-projects.json", "utf8"));
const allowedProjectStates = new Set([
  "all",
  "empty",
  "loading",
  "error",
  "expanded",
  "employment-only",
]);
if (typeof visualProjects !== "object" || visualProjects === null)
  throw new Error("visual-projects.json must be an object");
for (const [project, config] of Object.entries(visualProjects)) {
  if (
    !/^[a-z][a-z0-9-]*$/.test(project) ||
    typeof config !== "object" ||
    config === null ||
    typeof config.hostPath !== "string" ||
    !Array.isArray(config.states) ||
    !config.states.every((state) => allowedProjectStates.has(state))
  )
    throw new Error(`Invalid visual project contract for ${project}`);
  const projectConfig = JSON.parse(
    readFileSync(`apps/${project}/project.json`, "utf8"),
  );
  if (!projectConfig.targets?.screenshot)
    throw new Error(`Visual project ${project} has no Nx screenshot target`);
  const baseline = JSON.parse(
    readFileSync(`apps/${project}/visual/baseline/x86_64.json`, "utf8"),
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
  for (const state of ["happy", ...config.states])
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
const screencompSource = sources.find(
  ([name]) => name === "screencomp config",
)[1];
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
  if (!captureSource.includes(`"${state}"`))
    throw new Error(
      `Visual state ${state} is missing from capture-visual.mjs; update the capture and toggle contracts together`,
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
  if (!captureSource.includes(`"${value}"`))
    throw new Error(
      `Visual toggle value ${value} is missing from capture-visual.mjs`,
    );
}
console.log(
  "visual tool contract matches workflow, pre-push guard, and screencomp config",
);
