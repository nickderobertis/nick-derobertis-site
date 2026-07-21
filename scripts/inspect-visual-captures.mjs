import { createHash } from "node:crypto";
import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

process.on("uncaughtException", (error) => {
  console.error(
    `inspect-visual-captures: ${error instanceof Error ? error.message : String(error)}; discard the artifact and rerun the unprivileged visual capture workflow`,
  );
  process.exit(1);
});

const [rootArgument, expectedRepository, expectedHeadSha] =
  process.argv.slice(2);
if (!rootArgument) throw new Error("Expected artifact root");
if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(expectedRepository ?? ""))
  throw new Error("Expected repository must be an owner/repository name");
if (!/^[0-9a-f]{40}$/.test(expectedHeadSha ?? ""))
  throw new Error("Expected head SHA must be a full lowercase commit SHA");
const root = path.resolve(rootArgument);
const trustedProjects = JSON.parse(
  readFileSync("visual-projects.json", "utf8"),
);
if (typeof trustedProjects !== "object" || trustedProjects === null)
  throw new Error("Trusted visual project configuration is invalid");

function hasExactKeys(value, keys) {
  return (
    typeof value === "object" &&
    value !== null &&
    Object.keys(value).length === keys.length &&
    Object.keys(value).every((key) => keys.includes(key))
  );
}

function readBoundedRegularFile(file, maximumBytes) {
  if (!existsSync(file)) throw new Error(`Missing artifact file: ${file}`);
  const metadata = lstatSync(file);
  if (!metadata.isFile() || metadata.isSymbolicLink())
    throw new Error(`Artifact path is not a regular file: ${file}`);
  if (metadata.size > maximumBytes)
    throw new Error(`Artifact file exceeds its size limit: ${file}`);
  return readFileSync(file);
}

function collectFiles(directory, relative = "") {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const relativePath = path.posix.join(relative, entry.name);
    const absolutePath = path.join(directory, entry.name);
    const metadata = lstatSync(absolutePath);
    if (metadata.isSymbolicLink())
      throw new Error(`Artifact contains a symbolic link: ${relativePath}`);
    if (metadata.isDirectory())
      files.push(...collectFiles(absolutePath, relativePath));
    else if (metadata.isFile()) files.push(relativePath);
    else
      throw new Error(
        `Artifact contains an unsupported entry: ${relativePath}`,
      );
  }
  return files;
}

function validatePng(image, project, imageName) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (
    image.length < 33 ||
    !image.subarray(0, 8).equals(signature) ||
    image.readUInt32BE(8) !== 13 ||
    image.subarray(12, 16).toString("ascii") !== "IHDR"
  )
    throw new Error(`Capture is not a PNG for ${project}: ${imageName}`);
  const width = image.readUInt32BE(16);
  const height = image.readUInt32BE(20);
  if (width < 1 || height < 1 || width > 16_384 || height > 16_384)
    throw new Error(
      `Capture dimensions are invalid for ${project}: ${imageName}`,
    );
}

const signalPath = path.join(root, "visual-capture.json");
const affectedPath = path.join(root, "affected-visual-projects.txt");
const signal = JSON.parse(readBoundedRegularFile(signalPath, 1024 * 1024));
if (
  !hasExactKeys(signal, ["schema", "repository", "headSha", "affectedCount"]) ||
  signal.schema !== 1 ||
  signal.repository !== expectedRepository ||
  signal.headSha !== expectedHeadSha ||
  !Number.isSafeInteger(signal.affectedCount) ||
  signal.affectedCount < 0
)
  throw new Error("Visual capture provenance signal is invalid");
const projects = readBoundedRegularFile(affectedPath, 1024 * 1024)
  .toString("utf8")
  .split("\n")
  .filter(Boolean);
if (
  new Set(projects).size !== projects.length ||
  projects.length !== signal.affectedCount
)
  throw new Error(
    "Affected visual project count does not match the capture signal",
  );

for (const project of projects) {
  if (
    !/^[a-z][a-z0-9-]*$/.test(project) ||
    !Object.hasOwn(trustedProjects, project)
  )
    throw new Error(`Invalid affected visual project: ${project}`);
  const projectConfig = trustedProjects[project];
  if (
    !hasExactKeys(projectConfig, ["hostPath", "states"]) ||
    !Array.isArray(projectConfig.states)
  )
    throw new Error(
      `Trusted visual project configuration is invalid for ${project}`,
    );
  const allowedShots = new Set();
  for (const render of ["standalone", "host-composed"])
    for (const viewport of ["desktop", "tablet", "mobile"])
      allowedShots.add(`${render}/happy/${viewport}`);
  for (const state of projectConfig.states)
    for (const render of ["standalone", "host-composed"])
      allowedShots.add(`${render}/${state}/desktop`);

  const captureRoot = path.join(
    root,
    "apps",
    project,
    "visual",
    "current",
    "x86_64",
  );
  const capturesPath = path.join(captureRoot, "captures.json");
  const manifest = JSON.parse(
    readBoundedRegularFile(capturesPath, 1024 * 1024),
  );
  if (
    !hasExactKeys(manifest, ["schema", "shots"]) ||
    manifest.schema !== 1 ||
    !Array.isArray(manifest.shots) ||
    manifest.shots.length !== allowedShots.size
  )
    throw new Error(`Invalid captures manifest for ${project}`);

  const declaredFiles = new Set(["captures.json"]);
  const declaredShots = new Set();
  for (const shot of manifest.shots) {
    if (
      !hasExactKeys(shot, ["name", "toggles", "hash", "image"]) ||
      shot.name !== project ||
      !hasExactKeys(shot.toggles, ["render", "state", "viewport"]) ||
      typeof shot.toggles.render !== "string" ||
      typeof shot.toggles.state !== "string" ||
      typeof shot.toggles.viewport !== "string" ||
      typeof shot.hash !== "string" ||
      !/^[0-9a-f]{64}$/.test(shot.hash) ||
      typeof shot.image !== "string"
    )
      throw new Error(`Invalid capture entry for ${project}`);
    const shotKey = `${shot.toggles.render}/${shot.toggles.state}/${shot.toggles.viewport}`;
    const expectedImage = `${shotKey}.png`;
    if (
      !allowedShots.has(shotKey) ||
      shot.image !== expectedImage ||
      declaredShots.has(shotKey) ||
      declaredFiles.has(shot.image)
    )
      throw new Error(
        `Duplicate or undeclared capture for ${project}: ${shotKey}`,
      );
    declaredShots.add(shotKey);
    declaredFiles.add(shot.image);
    const image = readBoundedRegularFile(
      path.join(captureRoot, shot.image),
      20 * 1024 * 1024,
    );
    validatePng(image, project, shot.image);
    const actualHash = createHash("sha256").update(image).digest("hex");
    if (actualHash !== shot.hash)
      throw new Error(`Capture hash mismatch for ${project}: ${shot.image}`);
  }
  if (declaredShots.size !== allowedShots.size)
    throw new Error(`Captures are missing required shots for ${project}`);
  const actualFiles = collectFiles(captureRoot);
  if (
    actualFiles.length !== declaredFiles.size ||
    actualFiles.some((file) => !declaredFiles.has(file))
  )
    throw new Error(`Capture tree contains undeclared files for ${project}`);
}
process.stdout.write(`has_affected=${projects.length > 0}\n`);
