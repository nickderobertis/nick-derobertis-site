import { readFileSync } from "node:fs";
import {
  contentStoreAppRoot,
  contentStoreBranch,
  contentStoreCheckout,
  publishWorkdirDefault,
} from "../../libs/publish-config/src/publish-fragment.ts";

// The content-store branch, the deploy lane's working copy of it, and the
// scratch repository a publish lane pushes from are named in five places that
// cannot import each other: the Pages workflow, the ignore rules, and three
// documents. libs/publish-config/src/publish-fragment.ts is the one source; this
// holds every restatement to it, so a renamed branch cannot leave the workflow
// publishing to one ref while the deploy lane composes another.
//
// llmlint: ignore-file[changed_behavior_has_e2e] This is a repository contract verifier with no browser interface: it reads committed configuration and exits non-zero, so nothing it does is observable to a visitor. content-store-contract.spec.ts drives `just lint-workflows`, the gate that runs it, over the committed tree and over the tree with one restatement moved.
function fail(message) {
  console.error(
    `verify-content-store-contract: ${message}; libs/publish-config/src/publish-fragment.ts owns these names, so align the restatement with it and rerun just lint-workflows`,
  );
  process.exit(1);
}

function read(path) {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    fail(
      `${path} could not be read (${error instanceof Error ? error.message : String(error)})`,
    );
  }
}

const workflowPath = ".github/workflows/pages.yml";
const workflow = read(workflowPath);

const declared = /^ {2}CONTENT_STORE_BRANCH:\s*(\S+)$/m.exec(workflow)?.[1];
if (declared !== contentStoreBranch)
  fail(
    `${workflowPath} sets CONTENT_STORE_BRANCH to ${JSON.stringify(declared)} but the content store is ${contentStoreBranch}`,
  );

// The deploy lane checks the branch out at one path and then composes from that
// path's app root. Both restate the contract, and a mismatch would compose an
// empty site rather than fail.
if (!workflow.includes(`path: ${contentStoreCheckout}`))
  fail(
    `${workflowPath} does not check the content store out at ${contentStoreCheckout}`,
  );
if (
  !workflow.includes(
    `just compose ${contentStoreCheckout}/${contentStoreAppRoot} `,
  )
)
  fail(
    `${workflowPath} does not compose from ${contentStoreCheckout}/${contentStoreAppRoot}`,
  );

// Both working copies are scratch and must never be committed.
const ignoreRules = read(".gitignore");
for (const directory of [contentStoreCheckout, publishWorkdirDefault]) {
  if (!ignoreRules.includes(`${directory}/`))
    fail(`.gitignore does not ignore the ${directory}/ working copy`);
}

// Every document that tells a reader where published bytes live has to name the
// branch they actually live on.
for (const document of ["AGENTS.md", "README.md", "docs/architecture.md"]) {
  if (!read(document).includes(contentStoreBranch))
    fail(
      `${document} describes the deploy split without naming ${contentStoreBranch}`,
    );
}

process.stdout.write(
  `content-store contract agrees: branch ${contentStoreBranch}, checkout ${contentStoreCheckout}, app root ${contentStoreAppRoot}, lane workdir ${publishWorkdirDefault}\n`,
);
