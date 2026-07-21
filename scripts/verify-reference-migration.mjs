import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const migration = JSON.parse(
  readFileSync("reference/screenshots/screencomp-migration.json", "utf8"),
);
if (
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
  if (!existsSync(`apps/${owner}/visual/baseline/x86_64.json`))
    throw new Error(
      `Reference owner ${owner} has no screencomp baseline; run its screenshot target and seed apps/${owner}/visual/baseline/x86_64.json with screencomp manifest`,
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
