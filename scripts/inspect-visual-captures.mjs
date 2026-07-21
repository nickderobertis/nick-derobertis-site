import { existsSync, lstatSync, readFileSync, writeFileSync } from "node:fs";

const [root, expectedRepository, expectedHeadSha, outputFile] =
  process.argv.slice(2);
if (!root || !outputFile)
  throw new Error("Expected artifact root and output file");
const signalPath = `${root}/visual-capture.json`;
const affectedPath = `${root}/affected-visual-projects.txt`;
for (const artifactFile of [signalPath, affectedPath])
  if (
    !existsSync(artifactFile) ||
    !lstatSync(artifactFile).isFile() ||
    lstatSync(artifactFile).size > 1024 * 1024
  )
    throw new Error(`Invalid visual artifact control file: ${artifactFile}`);
const signal = JSON.parse(readFileSync(signalPath, "utf8"));
if (
  typeof signal !== "object" ||
  signal === null ||
  signal.schema !== 1 ||
  signal.repository !== expectedRepository ||
  signal.headSha !== expectedHeadSha ||
  !Number.isSafeInteger(signal.affectedCount) ||
  signal.affectedCount < 0
)
  throw new Error("Visual capture provenance signal is invalid");
const projects = readFileSync(affectedPath, "utf8").split("\n").filter(Boolean);
if (
  new Set(projects).size !== projects.length ||
  projects.length !== signal.affectedCount
)
  throw new Error(
    "Affected visual project count does not match the capture signal",
  );
for (const project of projects) {
  if (!/^[a-z][a-z0-9-]*$/.test(project))
    throw new Error(`Invalid affected visual project: ${project}`);
  const captures = `${root}/apps/${project}/visual/current/x86_64/captures.json`;
  if (!existsSync(captures) || !lstatSync(captures).isFile())
    throw new Error(`Missing captures manifest for ${project}`);
  if (lstatSync(captures).size > 1024 * 1024)
    throw new Error(`Captures manifest is too large for ${project}`);
  const manifest = JSON.parse(readFileSync(captures, "utf8"));
  if (
    typeof manifest !== "object" ||
    manifest === null ||
    manifest.schema !== 1 ||
    !Array.isArray(manifest.shots) ||
    manifest.shots.length === 0
  )
    throw new Error(`Invalid captures manifest for ${project}`);
  for (const shot of manifest.shots) {
    if (
      typeof shot !== "object" ||
      shot === null ||
      typeof shot.image !== "string" ||
      !/^(?:standalone|host-composed)\/[a-z-]+\/(?:desktop|tablet|mobile)\.png$/.test(
        shot.image,
      )
    )
      throw new Error(`Invalid capture entry for ${project}`);
    const image = `${root}/apps/${project}/visual/current/x86_64/${shot.image}`;
    if (
      !existsSync(image) ||
      !lstatSync(image).isFile() ||
      lstatSync(image).size > 20 * 1024 * 1024
    )
      throw new Error(`Invalid capture image for ${project}: ${shot.image}`);
  }
}
writeFileSync(outputFile, `has_affected=${projects.length > 0}\n`);
