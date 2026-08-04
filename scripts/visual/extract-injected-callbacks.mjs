import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// llmlint: ignore-file[changed_behavior_has_e2e] This CLI/filesystem extractor has no browser interface; lint-workflows executes its real boundary against the committed workflow and hands the result to shellcheck.

// screencomp's reusable workflow injects these strings into a `run:` step that
// declares no `shell:`, so the container's /bin/sh (dash) executes them. A
// bash-only construct there does not fail loudly: it exits 127, takes the
// failure branch, and reports a bogus domain error that reads as visual drift.
// actionlint shellchecks literal `run:` blocks only, so a callback passed
// through `with:` reaches CI unlinted unless it is extracted and checked here.
const workflowPath = ".github/workflows/visual-docs.yml";
const injectedCallbacks = ["capture-command"];

process.on("uncaughtException", (error) => {
  console.error(
    `extract-injected-callbacks: ${error instanceof Error ? error.message : String(error)}; repair ${workflowPath} and rerun just lint-workflows`,
  );
  process.exit(1);
});

const [outputDirectory] = process.argv.slice(2);
if (typeof outputDirectory !== "string" || outputDirectory.length === 0)
  throw new Error(
    "an output directory argument is required, for example just lint-workflows",
  );

function extractBlockScalar(lines, key) {
  const start = lines.findIndex((line) =>
    new RegExp(`^\\s*${key}:\\s*\\|\\s*$`).test(line),
  );
  if (start === -1)
    throw new Error(
      `${workflowPath} must pass ${key} to the screencomp reusable workflow as a literal block scalar`,
    );
  const keyIndent = /^\s*/.exec(lines[start])[0].length;
  const bodyIndent = /^\s*/.exec(lines[start + 1] ?? "")[0];
  if (bodyIndent.length <= keyIndent)
    throw new Error(
      `${workflowPath} ${key} block is empty; restore the callback`,
    );
  const body = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === "") {
      body.push("");
      continue;
    }
    if (!line.startsWith(bodyIndent)) break;
    body.push(line.slice(bodyIndent.length));
  }
  return `${body.join("\n").trimEnd()}\n`;
}

const lines = readFileSync(workflowPath, "utf8").split("\n");
mkdirSync(outputDirectory, { recursive: true });
for (const key of injectedCallbacks) {
  // GitHub expands `${{ … }}` before the shell ever sees it, so a placeholder
  // keeps shellcheck parsing the shell rather than the expression syntax.
  const callback = extractBlockScalar(lines, key).replaceAll(
    /\$\{\{[^}]*\}\}/g,
    "expression",
  );
  writeFileSync(join(outputDirectory, `${key}.sh`), callback);
}
console.log(
  `extracted ${injectedCallbacks.length} injected screencomp callback(s) from ${workflowPath}`,
);
