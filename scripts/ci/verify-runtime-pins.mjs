import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Every workflow provisions the same bun and Node it runs the workspace with.
// package.json's `packageManager` field is the authoritative bun pin — `just
// bootstrap` refuses any other bun — so a workflow or `.tool-versions` naming a
// different release silently installs through a resolver that can rewrite
// bun.lock differently from the one contributors use. Node has
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
const declaredBun = /^bun@(\d+\.\d+\.\d+)$/.exec(
  typeof manifest?.packageManager === "string" ? manifest.packageManager : "",
)?.[1];
if (!declaredBun)
  fail(
    'package.json must declare an exact "packageManager": "bun@x.y.z" as the authoritative bun pin',
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

const bunPins = [];
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
  // The literal `with:` values, the workflow-level env indirection a workflow
  // may define for them, and a bun a job installs itself (the visual capture
  // runs inside a container setup-bun never reaches) are all pins a reader has
  // to keep in step.
  for (const [pattern, pins] of [
    [/(?:BUN_VERSION:|bun-version:|\bbun@)\s*"?(\d+\.\d+\.\d+)"?/g, bunPins],
    [/(?:NODE_VERSION:|node-version:)\s*"?(\d+\.\d+\.\d+)"?/g, nodePins],
  ])
    for (const match of source.matchAll(pattern))
      pins.push({ path, version: match[1] });
}

if (bunPins.length === 0 || nodePins.length === 0)
  fail("no workflow pins a bun and Node version to verify");

// asdf reads `.tool-versions`, so a contributor's local bun is pinned there too.
let toolVersions = "";
try {
  toolVersions = readFileSync(".tool-versions", "utf8");
} catch (error) {
  fail(
    `.tool-versions could not be read (${error instanceof Error ? error.message : String(error)}); restore it with a bun line`,
  );
}
const toolBun = /^bun\s+(\S+)\s*$/m.exec(toolVersions)?.[1];
bunPins.push({ path: ".tool-versions", version: toolBun ?? "no bun line" });

const drifted = bunPins.filter((pin) => pin.version !== declaredBun);
if (drifted.length > 0)
  fail(
    `package.json pins bun ${declaredBun} but ${drifted.map((pin) => `${pin.path} pins ${pin.version}`).join(", ")}`,
  );

// Two tool configurations name a version package.json already pins: Biome's
// schema URL, which describes the options the installed Biome accepts, and the
// Playwright image visual capture runs in, whose browsers must be the ones the
// installed @playwright/test drives. package.json is the source for both.
const toolPins = [
  {
    path: "biome.json",
    dependency: "@biomejs/biome",
    read: (source) =>
      /biomejs\.dev\/schemas\/(\d+\.\d+\.\d+)\/schema\.json/.exec(
        JSON.parse(source)?.$schema ?? "",
      )?.[1],
  },
  {
    path: "visual-tools.json",
    dependency: "@playwright/test",
    read: (source) =>
      /^mcr\.microsoft\.com\/playwright:v(\d+\.\d+\.\d+)-/.exec(
        JSON.parse(source)?.playwrightContainer ?? "",
      )?.[1],
  },
];
for (const { path, dependency, read } of toolPins) {
  const declared = manifest?.devDependencies?.[dependency];
  if (typeof declared !== "string" || !/^\d+\.\d+\.\d+$/.test(declared))
    fail(`package.json must pin ${dependency} to an exact version`);
  let pinned;
  try {
    pinned = read(readFileSync(path, "utf8"));
  } catch (error) {
    fail(
      `${path} could not be read as JSON (${error instanceof Error ? error.message : String(error)}); restore it`,
    );
  }
  if (pinned !== declared)
    fail(
      `package.json pins ${dependency} ${declared} but ${path} names ${pinned ?? "no version"}`,
    );
}

const nodeVersions = [...new Set(nodePins.map((pin) => pin.version))];
if (nodeVersions.length > 1)
  fail(
    `workflows disagree on the Node runtime (${nodePins.map((pin) => `${pin.path}: ${pin.version}`).join(", ")})`,
  );

process.stdout.write(
  `runtime pins agree: bun ${declaredBun} (${bunPins.length} references), Node ${nodeVersions[0]} (${nodePins.length} references), ${toolPins.map((pin) => pin.dependency).join(" and ")} matching package.json\n`,
);
