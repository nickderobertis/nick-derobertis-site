import { readFileSync, writeFileSync } from "node:fs";

process.on("uncaughtException", (error) => {
  console.error(
    `write-visual-capture-signal: ${error instanceof Error ? error.message : String(error)}; verify the GitHub capture context and rerun the unprivileged capture workflow`,
  );
  process.exit(1);
});

const repository = process.env.CAPTURE_REPOSITORY ?? "";
const headSha = process.env.CAPTURE_HEAD_SHA ?? "";
if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository))
  throw new Error("CAPTURE_REPOSITORY must be an owner/repository name");
if (!/^[0-9a-f]{40}$/.test(headSha))
  throw new Error("CAPTURE_HEAD_SHA must be a full lowercase commit SHA");
const projects = readFileSync("affected-visual-projects.txt", "utf8")
  .split("\n")
  .filter(Boolean);
if (!projects.every((project) => /^[a-z][a-z0-9-]*$/.test(project)))
  throw new Error("Affected visual projects contain an invalid project name");
writeFileSync(
  "visual-capture.json",
  `${JSON.stringify({ schema: 1, repository, headSha, affectedCount: projects.length }, null, 2)}\n`,
);
