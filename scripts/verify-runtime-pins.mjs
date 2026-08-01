import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Every workflow provisions the same pnpm and Node it runs the workspace with.
// package.json's `packageManager` field is the authoritative pnpm pin — Corepack
// and `just bootstrap` already obey it — so a workflow that names a different
// version silently installs a different resolver than contributors use. Node has
// no comparable declaration, so this gate holds every workflow to one value
// instead, which is what keeps the Pages publish lanes, the CI gate, and the
// visual capture on the same runtime.
//
// llmlint: ignore-file[changed_behavior_has_e2e] This is a repository contract verifier with no browser interface: it reads committed configuration and exits non-zero, so nothing it does is observable to a visitor. runtime-pins.spec.ts drives this exact command as a real subprocess over the committed tree and over a drifted copy of it.
const workflowRoot = ".github/workflows";

function fail(message) {
  console.error(
    `verify-runtime-pins: ${message}; align the pins and rerun just lint-workflows`,
  );
  process.exit(1);
}

let manifest;
try {
  manifest = JSON.parse(readFileSync("package.json", "utf8"));
} catch (error) {
  fail(
    `package.json could not be read as JSON (${error instanceof Error ? error.message : String(error)}); repair the workspace manifest`,
  );
}
const declaredPnpm = /^pnpm@(\d+\.\d+\.\d+)$/.exec(
  typeof manifest?.packageManager === "string" ? manifest.packageManager : "",
)?.[1];
if (!declaredPnpm)
  fail(
    'package.json must declare an exact "packageManager": "pnpm@x.y.z" as the authoritative pnpm pin',
  );

let workflows;
try {
  workflows = readdirSync(workflowRoot).filter((name) => name.endsWith(".yml"));
} catch (error) {
  fail(
    `${workflowRoot} could not be read (${error instanceof Error ? error.message : String(error)}); run this from the repository root`,
  );
}
if (workflows.length === 0) fail(`${workflowRoot} declares no workflows`);

const pnpmPins = [];
const nodePins = [];
for (const name of workflows) {
  const path = join(workflowRoot, name);
  let source;
  try {
    source = readFileSync(path, "utf8");
  } catch (error) {
    fail(
      `${path} could not be read (${error instanceof Error ? error.message : String(error)}); restore or remove that workflow`,
    );
  }
  // Both the literal `with:` values and the workflow-level env indirection a
  // workflow may define for them are pins a reader has to keep in step.
  for (const [pattern, pins] of [
    [
      /(?:PNPM_VERSION:|pnpm\/action-setup@v\d[\s\S]{0,120}?version:)\s*"?(\d+\.\d+\.\d+)"?/g,
      pnpmPins,
    ],
    [/(?:NODE_VERSION:|node-version:)\s*"?(\d+\.\d+\.\d+)"?/g, nodePins],
  ])
    for (const match of source.matchAll(pattern))
      pins.push({ path, version: match[1] });
}

if (pnpmPins.length === 0 || nodePins.length === 0)
  fail("no workflow pins a pnpm and Node version to verify");

const drifted = pnpmPins.filter((pin) => pin.version !== declaredPnpm);
if (drifted.length > 0)
  fail(
    `package.json pins pnpm ${declaredPnpm} but ${drifted.map((pin) => `${pin.path} pins ${pin.version}`).join(", ")}`,
  );

const nodeVersions = [...new Set(nodePins.map((pin) => pin.version))];
if (nodeVersions.length > 1)
  fail(
    `workflows disagree on the Node runtime (${nodePins.map((pin) => `${pin.path}: ${pin.version}`).join(", ")})`,
  );

process.stdout.write(
  `runtime pins agree: pnpm ${declaredPnpm} (${pnpmPins.length} references), Node ${nodeVersions[0]} (${nodePins.length} references)\n`,
);
