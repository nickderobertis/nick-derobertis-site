import { readFileSync } from "node:fs";

process.on("uncaughtException", (error) => {
  console.error(
    `verify-visual-contract: ${error instanceof Error ? error.message : String(error)}; update visual-tools.json and every visual consumer together`,
  );
  process.exit(1);
});

const contract = JSON.parse(readFileSync("visual-tools.json", "utf8"));
const contractKeys = [
  "architecture",
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
    "visual-tools.json must contain non-empty architecture, playwrightContainer, and screencompVersion strings",
  );
const sources = [
  ["workflow", readFileSync(".github/workflows/visual-docs.yml", "utf8")],
  ["visual runner", readFileSync("scripts/visual-project.sh", "utf8")],
  ["bootstrap", readFileSync("justfile", "utf8")],
  ["screencomp config", readFileSync("screencomp.toml", "utf8")],
];
const captureSource = readFileSync("scripts/capture-visual.mjs", "utf8");
const visualProjects = JSON.parse(readFileSync("visual-projects.json", "utf8"));
if (typeof visualProjects !== "object" || visualProjects === null)
  throw new Error("visual-projects.json must be an object");
for (const [project, config] of Object.entries(visualProjects)) {
  if (
    !/^[a-z][a-z0-9-]*$/.test(project) ||
    typeof config !== "object" ||
    config === null ||
    typeof config.hostPath !== "string" ||
    !Array.isArray(config.states) ||
    !config.states.every((state) => typeof state === "string")
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
  architecture: ["workflow", "visual runner", "screencomp config"],
  playwrightContainer: ["workflow", "visual runner"],
  screencompVersion: ["workflow", "bootstrap"],
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
  "visual tool contract matches workflow, runner, and screencomp config",
);
