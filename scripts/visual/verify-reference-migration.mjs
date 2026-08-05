import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

process.on("uncaughtException", (error) => {
  console.error(
    `verify-reference-migration: ${error instanceof Error ? error.message : String(error)}; repair the migration map or owned baselines and retry`,
  );
  process.exit(1);
});

const migration = JSON.parse(
  readFileSync("reference/screenshots/screencomp-migration.json", "utf8"),
);
const visualTools = JSON.parse(readFileSync("visual-tools.json", "utf8"));
if (
  !visualTools ||
  typeof visualTools !== "object" ||
  Array.isArray(visualTools) ||
  typeof visualTools.architecture !== "string" ||
  !/^[a-z0-9_]+$/.test(visualTools.architecture)
)
  throw new Error(
    "Invalid visual architecture contract; repair visual-tools.json",
  );
if (
  typeof migration !== "object" ||
  migration === null ||
  Array.isArray(migration) ||
  migration.schema !== 1 ||
  migration.sourceCommit !== "c7fe035" ||
  typeof migration.groups !== "object" ||
  migration.groups === null
)
  throw new Error(
    "Invalid screencomp reference migration contract; repair reference/screenshots/screencomp-migration.json",
  );

const referenceRoot = path.resolve("reference/screenshots");
const mappedFiles = [];
for (const [group, owner] of Object.entries(migration.groups)) {
  if (typeof owner !== "string" || !/^[a-z][a-z0-9-]*$/.test(owner))
    throw new Error(
      `Invalid owner for reference group ${group}; update its owner in reference/screenshots/screencomp-migration.json`,
    );
  const groupRoot = path.resolve(referenceRoot, group);
  if (
    !groupRoot.startsWith(`${referenceRoot}${path.sep}`) ||
    !existsSync(groupRoot)
  )
    throw new Error(
      `Missing PR #12 reference group: ${group}; restore its PNGs or remove the stale mapping from screencomp-migration.json`,
    );
  const pngs = readdirSync(groupRoot).filter((file) => file.endsWith(".png"));
  if (pngs.length === 0)
    throw new Error(
      `Reference group has no PNGs: ${group}; restore its PR #12 PNGs or remove the stale migration entry`,
    );
  mappedFiles.push(...pngs.map((file) => path.join(groupRoot, file)));
  const baseline = `apps/${owner}/visual/baseline/${visualTools.architecture}.json`;
  if (!existsSync(baseline))
    throw new Error(
      `Reference owner ${owner} has no screencomp baseline; run its screenshot target and seed ${baseline} with a screencomp manifest`,
    );
}

const allReferencePngs = [];
for (const section of ["home-panes", "routes"]) {
  for (const group of readdirSync(path.join(referenceRoot, section))) {
    const groupRoot = path.join(referenceRoot, section, group);
    allReferencePngs.push(
      ...readdirSync(groupRoot)
        .filter((file) => file.endsWith(".png"))
        .map((file) => path.join(groupRoot, file)),
    );
  }
}
if (new Set(mappedFiles).size !== new Set(allReferencePngs).size)
  throw new Error(
    "A PR #12 reference PNG is not mapped; add its group to reference/screenshots/screencomp-migration.json or remove the stale PNG",
  );
console.log(`verified ${allReferencePngs.length} PR #12 reference PNGs`);
