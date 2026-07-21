import { readFileSync } from "node:fs";

process.on("uncaughtException", (error) => {
  console.error(
    `verify-visual-contract: ${error instanceof Error ? error.message : String(error)}; update visual-tools.json and every visual consumer together`,
  );
  process.exit(1);
});

const contract = JSON.parse(readFileSync("visual-tools.json", "utf8"));
if (
  typeof contract !== "object" ||
  contract === null ||
  !["architecture", "playwrightContainer", "screencompVersion"].every(
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
const expectedConsumers = {
  architecture: 3,
  playwrightContainer: 2,
  screencompVersion: 2,
};
for (const [key, value] of Object.entries(contract)) {
  const matches = sources.filter(([, source]) => source.includes(value));
  if (matches.length !== expectedConsumers[key])
    throw new Error(
      `Visual contract ${key}=${value} is not drift-checked across its consumers; update visual-tools.json and every visual consumer together`,
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
