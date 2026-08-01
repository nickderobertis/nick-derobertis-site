import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, normalize, resolve, sep } from "node:path";
import { fragmentContractSchema } from "./fragment-contract.ts";

// llmlint: ignore-block[changed_behavior_has_e2e] The remote registry is a build-time config file with no browser interface: a malformed manifest is rejected before any lane writes bytes, so no artifact and nothing servable exists on that path. publish-fragment.spec.ts drives the derived lane list through the real exported API, and publish-lanes.spec.ts drives it through the real selection CLI.
/**
 * Narrows the canonical remote registry before any lane name is derived from
 * it. A publish lane's name becomes a branch subtree path, so a manifest key
 * that is not a plain project name must be rejected here rather than reaching
 * git.
 */
export function validatedRemoteRegistry(
  value: unknown,
): Record<string, string> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length === 0 ||
    Object.keys(value).some((name) => !/^[a-z][a-z0-9-]*$/.test(name)) ||
    Object.values(value).some((alias) => typeof alias !== "string")
  )
    throw new Error(
      "libs/build-config/src/remotes.json must map every remote's project name to a federation alias string. Fix the remote registry and rerun just publish-fragment.",
    );
  return value as Record<string, string>;
}
// llmlint: ignore-end[changed_behavior_has_e2e]

const remoteManifest = validatedRemoteRegistry(
  createRequire(import.meta.url)("./remotes.json"),
);

/** The shell plus every federated remote publishes exactly one subtree. */
export const publishableApps: readonly string[] = [
  "shell",
  ...Object.keys(remoteManifest),
];

/** Every app's published bytes live under this directory on the branch. */
export const contentStoreAppRoot = "apps";

/** The notice committed at the content-store root when the branch is created. */
export const contentStoreNoticePath = "README.md";

/**
 * The three branch names this repository refuses as a content store. They are
 * not every branch GitHub Pages can be pointed at — Pages will serve any branch
 * — but they are the conventional ones, and they are the ones a misconfigured
 * lane would plausibly reach. The content store holds unassembled per-app
 * bytes, so serving it would publish a directory listing of fragments instead of
 * the composed site, and would move the deploy back onto Pages' legacy branch
 * builder, whose newer-build-kills-older-build race is exactly what the workflow
 * artifact deploy avoids.
 */
const prohibitedContentStoreBranches = ["master", "main", "gh-pages"];

export const contentStoreNotice = `# Published fragment content store

Storage only. Every directory below \`${contentStoreAppRoot}/\` is one app's
independently published bytes (bundle, \`fragment.html\`, \`fragment.css\`,
\`fragment.json\`), written by that app's publish lane in
\`.github/workflows/pages.yml\` and by nothing else.

**This branch is never the served source.** GitHub Pages for this repository
stays on \`build_type: workflow\`: the compose-and-deploy lane assembles these
fragments into the real site and uploads it with \`actions/upload-pages-artifact\`.
Pointing Pages at this branch would serve unassembled fragments and would put
deploys back on the legacy branch builder, where a newer build kills an
in-flight one and records it \`errored\` with duration 0.
`;

export interface PublishOptions {
  readonly app: string;
  readonly source: string;
  readonly branch: string;
  readonly remote: string;
  readonly workdir: string;
  readonly attempts: number;
  readonly retryDelayMs: number;
}

export interface PublishResult {
  readonly app: string;
  readonly branch: string;
  readonly commit: string | undefined;
  readonly changed: boolean;
  readonly attempts: number;
}

interface GitResult {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

/** Push URLs carry an access token, so never surface one in a message. */
function redactCredentials(text: string) {
  return text.replace(/\/\/[^@\s/]*@/g, "//***@");
}

function git(args: readonly string[], cwd: string, allowFailure = false) {
  const result = spawnSync("git", [...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  if (result.error)
    throw new Error(
      `Could not run git ${redactCredentials(args.join(" "))} in ${cwd}: ${result.error.message}. Install git on the publish runner and retry.`,
    );
  const status = result.status ?? 1;
  if (status !== 0 && !allowFailure)
    throw new Error(
      `git ${redactCredentials(args.join(" "))} failed in ${cwd}: ${redactCredentials(`${stderr}${stdout}`).trim()}`,
    );
  return { status, stdout, stderr } satisfies GitResult;
}

// llmlint: ignore-block[changed_behavior_has_e2e] These are publish-lane input validators in a CI/CLI boundary with no browser interface: they reject a bad app, branch, remote, or path before any bytes are written, so no artifact and nothing servable exists on the failure path. publish-fragment.spec.ts drives them through the real exported API against a local bare repository.
export function validatedApp(value: string | undefined) {
  if (typeof value !== "string" || !publishableApps.includes(value))
    throw new Error(
      `PUBLISH_APP must name a publishable app (${publishableApps.join(", ")}); received ${JSON.stringify(value)}. Set it to the app whose subtree this lane owns and rerun just publish-fragment.`,
    );
  return value;
}

export function validatedBranch(value: string | undefined) {
  // The cheap shape check rejects anything unsafe to hand to a subprocess;
  // git itself then owns the actual ref-name grammar, which is far more
  // intricate than a regex here would honestly capture (trailing `/` or `.`,
  // `//`, `@{`, control characters, and more).
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._/-]{0,99}$/.test(value) ||
    spawnSync("git", ["check-ref-format", `refs/heads/${value}`], {
      encoding: "utf8",
    }).status !== 0
  )
    throw new Error(
      `PUBLISH_BRANCH must be a valid git branch name; received ${JSON.stringify(value)}. Set it to the content-store branch and rerun just publish-fragment.`,
    );
  if (prohibitedContentStoreBranches.includes(value))
    throw new Error(
      `PUBLISH_BRANCH must not be ${value}: the fragment content store is storage only and must never become a branch GitHub Pages could serve. Publish to a dedicated content-store branch and rerun just publish-fragment.`,
    );
  return value;
}

export function validatedRemote(value: string | undefined) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    /[\s\0]/.test(value) ||
    value.startsWith("-")
  )
    throw new Error(
      "PUBLISH_REMOTE must be a git remote URL or path with no whitespace. Set it to the content-store repository and rerun just publish-fragment.",
    );
  return value;
}

export function validatedPath(value: string | undefined, label: string) {
  if (typeof value !== "string" || value.length === 0 || value.includes("\0"))
    throw new Error(
      `${label} must be a non-empty filesystem path. Set it to a readable directory and rerun just publish-fragment.`,
    );
  // A leading dash reaches git and cp as an option rather than as a path, and a
  // `..` segment reads or writes outside the directory this lane was handed.
  if (value.startsWith("-") || normalize(value).split(sep).includes(".."))
    throw new Error(
      `${label} must be a filesystem path that neither begins with "-" nor traverses with ".."; received ${JSON.stringify(value)}. Set it to a directory this publish lane owns and rerun just publish-fragment.`,
    );
  return value;
}

/**
 * Scratch space, held to a stricter rule than a path this lane only reads: the
 * lane runs `git checkout --force` and `git clean -fd` here, so a value that is
 * or contains the workspace would destroy the checkout it was launched from.
 */
export function validatedWorkdir(value: string | undefined) {
  const path = validatedPath(value, "PUBLISH_WORKDIR");
  const resolved = resolve(path);
  const workspace = resolve(".");
  if (workspace === resolved || workspace.startsWith(`${resolved}${sep}`))
    throw new Error(
      `PUBLISH_WORKDIR must be scratch space this publish lane owns; ${resolved} is or contains the workspace, which the lane force-checks-out and cleans. Set it to a dedicated directory such as .publish-store and rerun just publish-fragment.`,
    );
  return path;
}

export function validatedCount(
  value: string | undefined,
  fallback: number,
  label: string,
) {
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10)
    throw new Error(
      `${label} must be an integer between 1 and 10; received ${JSON.stringify(value)}. Fix it and rerun just publish-fragment.`,
    );
  return parsed;
}

/**
 * Guards the promise every lane makes to the others: a publish commit may
 * touch only the app it owns, plus the root notice when it creates the branch.
 */
export function assertOwnSubtree(paths: readonly string[], app: string) {
  const prefix = `${contentStoreAppRoot}/${app}/`;
  const foreign = paths.filter(
    (path) => path !== contentStoreNoticePath && !path.startsWith(prefix),
  );
  if (foreign.length > 0)
    throw new Error(
      `The ${app} publish lane staged paths outside its own subtree (${foreign.slice(0, 5).join(", ")}). Every lane may write only ${prefix}, so refusing to overwrite another app's published bytes.`,
    );
  return paths;
}
// llmlint: ignore-end[changed_behavior_has_e2e]

function sleep(milliseconds: number) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds));
}

// llmlint: ignore-block[changed_behavior_has_e2e] Publishing is a git/filesystem boundary with no browser interface; publish-fragment.spec.ts drives it against a real local bare repository including the non-fast-forward recovery path, and the bytes it stores are driven through the browser by site.spec.ts and every feature journey once the compose lane assembles them.
async function readPublishedFragment(source: string, app: string) {
  for (const file of ["fragment.html", "fragment.css", "index.html"]) {
    if (!existsSync(join(source, file)))
      throw new Error(
        `The built ${app} artifact at ${source} has no ${file}. Run nx build ${app} before publishing, then rerun just publish-fragment.`,
      );
  }
  let contract: unknown;
  try {
    contract = JSON.parse(
      await readFile(join(source, "fragment.json"), "utf8"),
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Could not read the built ${app} fragment contract at ${join(source, "fragment.json")}: ${detail}. Run nx build ${app} before publishing, then rerun just publish-fragment.`,
    );
  }
  const parsed = fragmentContractSchema.safeParse(contract);
  if (!parsed.success)
    throw new Error(
      `The built ${app} fragment contract is invalid: ${parsed.error.issues.map((issue) => `${issue.path.join(".") || "contract"} ${issue.message}`).join("; ")}. Rebuild ${app} with the current fragment schema, then rerun just publish-fragment.`,
    );
  if (parsed.data.name !== app)
    throw new Error(
      `The artifact at ${source} publishes ${parsed.data.name}, not ${app}. Point PUBLISH_SOURCE at the ${app} build output and rerun just publish-fragment.`,
    );
  return parsed.data;
}

function prepareWorkdir(options: PublishOptions) {
  git(["init", "--quiet"], options.workdir);
  const existing = git(["remote"], options.workdir).stdout.split(/\s+/);
  git(
    existing.includes("origin")
      ? ["remote", "set-url", "origin", options.remote]
      : ["remote", "add", "origin", options.remote],
    options.workdir,
  );
  git(["config", "user.name", "github-actions[bot]"], options.workdir);
  git(
    [
      "config",
      "user.email",
      "41898282+github-actions[bot]@users.noreply.github.com",
    ],
    options.workdir,
  );
}

/**
 * Resets the working tree to whatever the content-store branch currently holds,
 * so each attempt re-applies this lane's subtree on top of every other lane's
 * latest published bytes instead of on top of a stale snapshot.
 */
function syncToBranchTip(options: PublishOptions, attempt: number) {
  const probe = git(
    ["ls-remote", "--exit-code", "--heads", "origin", options.branch],
    options.workdir,
    true,
  );
  if (probe.status !== 0 && probe.status !== 2)
    throw new Error(
      `Could not read the ${options.branch} content-store branch: ${redactCredentials(`${probe.stderr}${probe.stdout}`).trim()}. Check the publish credentials and rerun just publish-fragment.`,
    );
  if (probe.status === 0) {
    git(
      ["fetch", "--depth=1", "--no-tags", "origin", options.branch],
      options.workdir,
    );
    git(
      ["checkout", "--force", "-B", "publish", "FETCH_HEAD"],
      options.workdir,
    );
    git(["clean", "-fdq"], options.workdir);
    return;
  }
  if (
    git(["rev-parse", "--verify", "--quiet", "HEAD"], options.workdir, true)
      .status === 0
  ) {
    git(["checkout", "--orphan", `publish-new-${attempt}`], options.workdir);
    git(["rm", "-rq", "--cached", "--ignore-unmatch", "."], options.workdir);
    git(["clean", "-fdq"], options.workdir);
  }
}

async function stageOwnSubtree(options: PublishOptions) {
  const subtree = join(contentStoreAppRoot, options.app);
  const target = join(options.workdir, subtree);
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
  await cp(options.source, target, { recursive: true });
  git(["add", "--all", "--", subtree], options.workdir);
  const notice = join(options.workdir, contentStoreNoticePath);
  if (!existsSync(notice)) {
    await writeFile(notice, contentStoreNotice);
    git(["add", "--", contentStoreNoticePath], options.workdir);
  }
  const staged = git(["diff", "--cached", "--name-only"], options.workdir)
    .stdout.split("\n")
    .filter((path) => path.length > 0);
  return assertOwnSubtree(staged, options.app);
}

/**
 * Writes one app's published bytes to the content-store branch. Concurrent
 * lanes race for the branch tip, so a rejected push is expected rather than
 * exceptional: the next attempt re-reads the tip and re-applies this subtree,
 * which is what keeps a slower lane from reverting a faster one.
 */
export async function publishFragment(
  options: PublishOptions,
): Promise<PublishResult> {
  const contract = await readPublishedFragment(options.source, options.app);
  await mkdir(options.workdir, { recursive: true });
  prepareWorkdir(options);
  let lastFailure = "";
  for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
    syncToBranchTip(options, attempt);
    const staged = await stageOwnSubtree(options);
    if (staged.length === 0)
      return {
        app: options.app,
        branch: options.branch,
        commit: git(["rev-parse", "HEAD"], options.workdir).stdout.trim(),
        changed: false,
        attempts: attempt,
      };
    git(
      [
        "commit",
        "--quiet",
        "-m",
        `chore(publish): ${options.app} at ${contract.revision}`,
      ],
      options.workdir,
    );
    const pushed = git(
      ["push", "origin", `HEAD:refs/heads/${options.branch}`],
      options.workdir,
      true,
    );
    if (pushed.status === 0)
      return {
        app: options.app,
        branch: options.branch,
        commit: git(["rev-parse", "HEAD"], options.workdir).stdout.trim(),
        changed: true,
        attempts: attempt,
      };
    lastFailure = redactCredentials(`${pushed.stderr}${pushed.stdout}`).trim();
    if (attempt < options.attempts) await sleep(options.retryDelayMs * attempt);
  }
  throw new Error(
    `Could not publish the ${options.app} subtree to ${options.branch} after ${options.attempts} attempts; the branch tip kept moving. Last push failure: ${lastFailure}. Rerun just publish-fragment once the competing lanes settle.`,
  );
}
// llmlint: ignore-end[changed_behavior_has_e2e]

// llmlint: ignore-block[changed_behavior_has_e2e] This is the publish lane's environment boundary in a CI/CLI context with no browser interface: it resolves PUBLISH_* values and their defaults before any bytes are written, so a rejected value leaves no artifact and nothing servable. publish-fragment.spec.ts drives it through the real exported API for every default and every rejection, scripts/publish-fragment.mjs is the real CLI it feeds, and the bytes the resulting options publish are driven through the browser by site.spec.ts and every feature journey once the compose lane assembles them.
export function publishOptionsFromEnv(
  env: Record<string, string | undefined>,
): PublishOptions {
  const app = validatedApp(env.PUBLISH_APP);
  return {
    app,
    source: validatedPath(
      env.PUBLISH_SOURCE ?? `dist/apps/${app}`,
      "PUBLISH_SOURCE",
    ),
    branch: validatedBranch(env.PUBLISH_BRANCH),
    remote: validatedRemote(env.PUBLISH_REMOTE),
    workdir: validatedWorkdir(env.PUBLISH_WORKDIR ?? ".publish-store"),
    attempts: validatedCount(env.PUBLISH_ATTEMPTS, 5, "PUBLISH_ATTEMPTS"),
    retryDelayMs:
      validatedCount(env.PUBLISH_RETRY_SECONDS, 2, "PUBLISH_RETRY_SECONDS") *
      1000,
  };
}
// llmlint: ignore-end[changed_behavior_has_e2e]
