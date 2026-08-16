import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { serializeFragmentContract } from "@site/build-config";
import { afterEach, expect, test } from "vitest";
// The lane list is derived from the canonical registry, which build-config owns
// as a serialized build input rather than as part of its public surface.
// eslint-disable-next-line @nx/enforce-module-boundaries -- This spec reads the canonical serialized remote registry directly because it is a build input, not an exported module.
import remoteRegistry from "../../build-config/src/remotes.json";
import {
  assertOwnSubtree,
  contentStoreBranch,
  contentStoreNoticePath,
  publishableApps,
  publishFragment,
  publishOptionsFromEnv,
  validatedRemoteRegistry,
} from "./publish-fragment";

// The lane and its tests read the branch from the one source the drift gate holds every other restatement to.
const branch = contentStoreBranch;
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

function git(args: readonly string[], cwd: string) {
  const result = spawnSync("git", [...args], { cwd, encoding: "utf8" });
  if (result.status !== 0)
    throw new Error(
      `git ${args.join(" ")} in ${cwd} failed: ${result.stderr}${result.stdout}`,
    );
  return result.stdout;
}

/** The files every app build leaves behind for its publish lane to store. */
async function writeBuiltApp(
  directory: string,
  app: string,
  revision: string,
  markup = `<main>${app}</main>`,
) {
  await mkdir(directory, { recursive: true });
  await Promise.all([
    writeFile(join(directory, "fragment.html"), markup),
    writeFile(join(directory, "fragment.css"), `.${app}{color:#123456}`),
    writeFile(
      join(directory, "index.html"),
      `<!doctype html><html lang="en"><body><div id="root"></div></body></html>`,
    ),
    writeFile(
      join(directory, "fragment.json"),
      serializeFragmentContract({
        schemaVersion: 1,
        name: app,
        react: "19.2.7",
        reactDom: "19.2.7",
        revision,
      }),
    ),
  ]);
}

async function createContentStore(seeded: readonly string[] = []) {
  const root = await mkdtemp(join(tmpdir(), "publish-fragment-"));
  roots.push(root);
  const store = join(root, "store.git");
  git(["init", "--bare", "--quiet", "--initial-branch", branch, store], root);
  if (seeded.length > 0) {
    const seed = join(root, "seed");
    await mkdir(seed, { recursive: true });
    git(["init", "--quiet", "--initial-branch", branch], seed);
    git(["config", "user.name", "seed"], seed);
    git(["config", "user.email", "seed@example.invalid"], seed);
    for (const app of seeded)
      await writeBuiltApp(join(seed, "apps", app), app, "5eed000");
    await writeFile(join(seed, contentStoreNoticePath), "# content store\n");
    git(["add", "--all"], seed);
    git(["commit", "--quiet", "-m", "seed"], seed);
    git(["push", "--quiet", store, `HEAD:refs/heads/${branch}`], seed);
  }
  return { root, store, seed: join(root, "seed") };
}

/**
 * Parks a second lane's finished commit on its own ref, ready to become the
 * content-store tip the moment the lane under test is committed to its own
 * stale view of the branch.
 */
async function stageCompetingLane(seed: string, store: string, app: string) {
  await writeBuiltApp(
    join(seed, "apps", app),
    app,
    "c0ffee0",
    `<main>${app} won the race</main>`,
  );
  git(["add", "--all"], seed);
  git(["commit", "--quiet", "-m", `publish ${app}`], seed);
  git(["push", "--quiet", store, "HEAD:refs/heads/competing-lane"], seed);
}

function publishedPaths(store: string) {
  return git(["ls-tree", "-r", "--name-only", branch], store)
    .split("\n")
    .filter((path) => path.length > 0)
    .sort();
}

function publishedFile(store: string, path: string) {
  return git(["show", `${branch}:${path}`], store);
}

function tipChangedPaths(store: string) {
  return git(["show", "--name-only", "--pretty=format:", branch], store)
    .split("\n")
    .filter((path) => path.length > 0)
    .sort();
}

/**
 * Loses the race for real. The lane's own `post-checkout` hook fires the moment
 * `publishFragment` has synced to the branch tip it is about to build on, and
 * advances the content store to the parked competing commit — so by the time
 * this lane pushes, the tip it fetched is stale and git rejects the push as a
 * non-fast-forward. Pre-creating the working repository is safe because
 * `publishFragment` re-initializes it rather than replacing it.
 */
async function loseTheRaceOnce(workdir: string, store: string) {
  await mkdir(join(workdir, ".git", "hooks"), { recursive: true });
  git(["init", "--quiet"], workdir);
  await writeFile(
    join(workdir, ".git", "hooks", "post-checkout"),
    `#!/bin/sh
set -e
marker="$(git rev-parse --git-dir)/competing-lane-pushed"
if [ -e "$marker" ]; then exit 0; fi
: > "$marker"
git --git-dir='${store}' update-ref 'refs/heads/${branch}' refs/heads/competing-lane
`,
    { mode: 0o755 },
  );
}

function optionsFor(root: string, store: string, app: string) {
  return {
    app,
    source: join(root, "built", app),
    branch,
    remote: store,
    workdir: join(root, "workdir", app),
    attempts: 3,
    retryDelayMs: 0,
  };
}

test("a publish lane writes only its own subtree", async () => {
  const { root, store } = await createContentStore(["awards"]);
  await writeBuiltApp(join(root, "built", "shell"), "shell", "5be11ab");

  const result = await publishFragment(optionsFor(root, store, "shell"));

  expect(result).toMatchObject({ app: "shell", changed: true, attempts: 1 });
  expect(publishedPaths(store)).toEqual([
    contentStoreNoticePath,
    "apps/awards/fragment.css",
    "apps/awards/fragment.html",
    "apps/awards/fragment.json",
    "apps/awards/index.html",
    "apps/shell/fragment.css",
    "apps/shell/fragment.html",
    "apps/shell/fragment.json",
    "apps/shell/index.html",
  ]);
  expect(publishedFile(store, "apps/awards/fragment.html")).toBe(
    "<main>awards</main>",
  );
  expect(
    tipChangedPaths(store).every((path) => path.startsWith("apps/shell/")),
  ).toBe(true);
});

test("a rejected non-fast-forward push republishes onto the winning lane's tip", async () => {
  const { root, store, seed } = await createContentStore(["awards"]);
  await stageCompetingLane(seed, store, "bio");
  const options = optionsFor(root, store, "shell");
  await loseTheRaceOnce(options.workdir, store);
  await writeBuiltApp(join(root, "built", "shell"), "shell", "5be11ab");

  const result = await publishFragment(options);

  expect(result).toMatchObject({ app: "shell", changed: true, attempts: 2 });
  // The faster lane's bytes survive, and this lane's land on top of them.
  expect(publishedFile(store, "apps/bio/fragment.html")).toBe(
    "<main>bio won the race</main>",
  );
  expect(publishedFile(store, "apps/shell/fragment.html")).toBe(
    "<main>shell</main>",
  );
  expect(publishedFile(store, "apps/awards/fragment.html")).toBe(
    "<main>awards</main>",
  );
  expect(
    tipChangedPaths(store).every((path) => path.startsWith("apps/shell/")),
  ).toBe(true);
  // Seed, competing lane, then this lane: the discarded first attempt proves
  // the shell commit was rebuilt on the tip it had not seen when it started.
  expect(git(["rev-list", "--count", branch], store).trim()).toBe("3");
});

test("a lane that keeps losing the race reports the branch tip that moved", async () => {
  const { root, store } = await createContentStore(["awards"]);
  await writeBuiltApp(join(root, "built", "shell"), "shell", "5be11ab");
  await writeFile(
    join(store, "hooks", "pre-receive"),
    "#!/bin/sh\necho 'another lane is mid-flight' >&2\nexit 1\n",
    { mode: 0o755 },
  );

  await expect(
    publishFragment({ ...optionsFor(root, store, "shell"), attempts: 2 }),
  ).rejects.toThrow(/could not publish the shell subtree.*2 attempts/i);
});

test("the first lane creates the content store and its storage-only notice", async () => {
  const { root, store } = await createContentStore();
  await writeBuiltApp(join(root, "built", "awards"), "awards", "a1a1a1a");

  const result = await publishFragment(optionsFor(root, store, "awards"));

  expect(result.changed).toBe(true);
  expect(publishedPaths(store)).toContain(contentStoreNoticePath);
  expect(publishedFile(store, contentStoreNoticePath)).toMatch(
    /never the served source/,
  );
});

test("republishing identical bytes leaves the content store alone", async () => {
  const { root, store } = await createContentStore(["awards"]);
  await writeBuiltApp(join(root, "built", "awards"), "awards", "5eed000");

  const result = await publishFragment(optionsFor(root, store, "awards"));

  expect(result).toMatchObject({ changed: false, attempts: 1 });
  expect(git(["rev-list", "--count", branch], store).trim()).toBe("1");
});

test("a lane refuses an artifact that was built for another app", async () => {
  const { root, store } = await createContentStore(["awards"]);
  await writeBuiltApp(join(root, "built", "shell"), "awards", "a1a1a1a");

  await expect(
    publishFragment(optionsFor(root, store, "shell")),
  ).rejects.toThrow(/publishes awards, not shell/);
  expect(publishedPaths(store)).not.toContain("apps/shell/fragment.html");
});

test("a lane refuses to publish an app that was never built", async () => {
  const { root, store } = await createContentStore(["awards"]);

  await expect(publishFragment(optionsFor(root, store, "bio"))).rejects.toThrow(
    /has no fragment\.html/,
  );
});

test("a lane that cannot reach the content store names the credentials to check", async () => {
  const { root } = await createContentStore();
  await writeBuiltApp(join(root, "built", "shell"), "shell", "5be11ab");

  await expect(
    publishFragment({
      ...optionsFor(root, join(root, "never-created.git"), "shell"),
      attempts: 1,
    }),
  ).rejects.toThrow(
    new RegExp(`Could not read the ${branch} content-store branch`),
  );
});

test("a lane refuses a fragment contract it cannot parse", async () => {
  const { root, store } = await createContentStore(["awards"]);
  const source = join(root, "built", "shell");
  await writeBuiltApp(source, "shell", "5be11ab");
  await writeFile(join(source, "fragment.json"), "{ not json");

  await expect(
    publishFragment(optionsFor(root, store, "shell")),
  ).rejects.toThrow(/Could not read the built shell fragment contract/);
});

test("a lane refuses a fragment contract the published schema rejects", async () => {
  const { root, store } = await createContentStore(["awards"]);
  const source = join(root, "built", "shell");
  await writeBuiltApp(source, "shell", "5be11ab");
  await writeFile(
    join(source, "fragment.json"),
    JSON.stringify({ schemaVersion: 1, name: "shell" }),
  );

  await expect(
    publishFragment(optionsFor(root, store, "shell")),
  ).rejects.toThrow(/The built shell fragment contract is invalid/);
});

test("a lane names the whole contract when the built one is not an object", async () => {
  const { root, store } = await createContentStore(["awards"]);
  const source = join(root, "built", "shell");
  await writeBuiltApp(source, "shell", "5be11ab");
  // A contract that is not an object at all fails at its root, where the issue
  // names no field; the diagnostic has to say what was rejected anyway.
  await writeFile(join(source, "fragment.json"), "[]");

  await expect(
    publishFragment(optionsFor(root, store, "shell")),
  ).rejects.toThrow(/The built shell fragment contract is invalid: contract /);
});

test("a lane with no git on the runner names what to install", async () => {
  const { root, store } = await createContentStore(["awards"]);
  await writeBuiltApp(join(root, "built", "shell"), "shell", "5be11ab");
  // A runner that never installed git is the one failure the lane cannot read
  // an exit status from: git never starts, so it reports no output at all.
  const path = process.env.PATH;
  process.env.PATH = join(root, "no-tools");

  try {
    await expect(
      publishFragment(optionsFor(root, store, "shell")),
    ).rejects.toThrow(/Install git on the publish runner and retry/);
  } finally {
    process.env.PATH = path;
  }
});

test("a rerun reuses the lane's scratch repository rather than a second remote", async () => {
  const { root, store } = await createContentStore(["awards"]);
  const options = optionsFor(root, store, "shell");
  await writeBuiltApp(join(root, "built", "shell"), "shell", "5be11ab");
  await publishFragment(options);

  await writeBuiltApp(
    join(root, "built", "shell"),
    "shell",
    "5be11ab",
    "<main>shell again</main>",
  );
  const result = await publishFragment(options);

  expect(result).toMatchObject({ changed: true, attempts: 1 });
  expect(git(["remote"], options.workdir).trim()).toBe("origin");
  expect(publishedFile(store, "apps/shell/fragment.html")).toBe(
    "<main>shell again</main>",
  );
});

test("a lane seeds a second content store without carrying its first one's history", async () => {
  const { root, store } = await createContentStore(["awards"]);
  const options = optionsFor(root, store, "shell");
  await writeBuiltApp(join(root, "built", "shell"), "shell", "5be11ab");
  await publishFragment(options);

  const empty = await createContentStore();
  const result = await publishFragment({ ...options, remote: empty.store });

  expect(result).toMatchObject({ changed: true, attempts: 1 });
  expect(git(["rev-list", "--count", branch], empty.store).trim()).toBe("1");
  expect(publishedPaths(empty.store)).toEqual([
    contentStoreNoticePath,
    "apps/shell/fragment.css",
    "apps/shell/fragment.html",
    "apps/shell/fragment.json",
    "apps/shell/index.html",
  ]);
});

test("staging outside the owned subtree is refused before anything is committed", () => {
  expect(() =>
    assertOwnSubtree(
      ["apps/shell/fragment.html", "apps/awards/fragment.html"],
      "shell",
    ),
  ).toThrow(/staged paths outside its own subtree \(apps\/awards\/fragment/);
  expect(
    assertOwnSubtree(["README.md", "apps/shell/fragment.html"], "shell"),
  ).toEqual(["README.md", "apps/shell/fragment.html"]);
});

test.each(["master", "main", "gh-pages"])(
  "the content store may not be the conventionally served %s branch",
  (served) => {
    expect(() =>
      publishOptionsFromEnv({
        PUBLISH_APP: "shell",
        PUBLISH_BRANCH: served,
        PUBLISH_REMOTE: "https://github.example.invalid/site.git",
      }),
    ).toThrow(/must never become a branch GitHub Pages could serve/);
  },
);

// Names the shape check alone would wave through, but git itself refuses; a
// lane turns this value straight into a fetch and a push refspec.
test.each(["store/", "store.", "sto//re", "store.lock", "store@{1}"])(
  "the content store may not be the branch name %s that git rejects",
  (name) => {
    expect(() =>
      publishOptionsFromEnv({
        PUBLISH_APP: "shell",
        PUBLISH_BRANCH: name,
        PUBLISH_REMOTE: "https://github.example.invalid/site.git",
      }),
    ).toThrow(/must be a valid git branch name/);
  },
);

test.each([
  [
    "an unknown app",
    { PUBLISH_APP: "storefront" },
    /must name a publishable app/,
  ],
  [
    "a traversing branch",
    { PUBLISH_BRANCH: "refs/../evil" },
    /valid git branch name/,
  ],
  ["a blank remote", { PUBLISH_REMOTE: "" }, /must be a git remote URL/],
  [
    "an empty workdir",
    { PUBLISH_WORKDIR: "" },
    /PUBLISH_WORKDIR must be a non-empty/,
  ],
  [
    // Rejected because it still escapes once normalized; `dist/apps/x/../y`
    // does not, and stays a legitimate build output path.
    "a source that traverses above the workspace",
    { PUBLISH_SOURCE: "dist/../../elsewhere/apps/shell" },
    /PUBLISH_SOURCE must be a filesystem path that neither begins with "-" nor traverses/,
  ],
  [
    "a source git and cp would read as an option",
    { PUBLISH_SOURCE: "--exclude=apps" },
    /PUBLISH_SOURCE must be a filesystem path that neither begins with "-"/,
  ],
  [
    "a workdir that traverses out of the scratch directory",
    { PUBLISH_WORKDIR: "../.publish-store" },
    /PUBLISH_WORKDIR must be a filesystem path that neither begins with "-" nor traverses/,
  ],
  [
    // The lane force-checks-out and cleans its workdir, so this value would
    // wipe the checkout the lane is running from.
    "a workdir that is the workspace itself",
    { PUBLISH_WORKDIR: "." },
    /PUBLISH_WORKDIR must be scratch space this publish lane owns; .* is or contains the workspace/,
  ],
  [
    "too many attempts",
    { PUBLISH_ATTEMPTS: "99" },
    /PUBLISH_ATTEMPTS must be an integer/,
  ],
  [
    "a lane that would never attempt to publish",
    { PUBLISH_ATTEMPTS: "0" },
    /PUBLISH_ATTEMPTS must be an integer/,
  ],
  [
    "an attempt count that is not a number",
    { PUBLISH_ATTEMPTS: "several" },
    /PUBLISH_ATTEMPTS must be an integer/,
  ],
])("publish options reject %s", (_case, overrides, message) => {
  expect(() =>
    publishOptionsFromEnv({
      PUBLISH_APP: "shell",
      PUBLISH_BRANCH: branch,
      PUBLISH_REMOTE: "https://github.example.invalid/site.git",
      ...overrides,
    }),
  ).toThrow(message);
});

test("a workdir the lane did not create is refused before any checkout", async () => {
  const root = await mkdtemp(join(tmpdir(), "publish-workdir-"));
  roots.push(root);
  const occupied = join(root, "someone-elses-directory");
  await mkdir(occupied, { recursive: true });
  await writeFile(join(occupied, "keep.txt"), "not the lane's to clean\n");

  const options = () =>
    publishOptionsFromEnv({
      PUBLISH_APP: "shell",
      PUBLISH_BRANCH: branch,
      PUBLISH_REMOTE: "https://github.example.invalid/site.git",
      PUBLISH_WORKDIR: occupied,
    });

  expect(options).toThrow(/carries no publish-fragment-workdir marker/);

  // The lane's own scratch repository is accepted on a rerun, because
  // publishFragment marks it inside the git directory git clean cannot reach.
  const { store } = await createContentStore(["awards"]);
  await writeBuiltApp(join(root, "built", "shell"), "shell", "5be11ab");
  const lane = {
    ...optionsFor(root, store, "shell"),
    workdir: join(root, "scratch"),
  };
  await publishFragment(lane);

  expect(() =>
    publishOptionsFromEnv({
      PUBLISH_APP: "shell",
      PUBLISH_BRANCH: branch,
      PUBLISH_REMOTE: "https://github.example.invalid/site.git",
      PUBLISH_WORKDIR: lane.workdir,
    }),
  ).not.toThrow();
});

test("a workdir inside a git directory is refused", () => {
  expect(() =>
    publishOptionsFromEnv({
      PUBLISH_APP: "shell",
      PUBLISH_BRANCH: branch,
      PUBLISH_REMOTE: "https://github.example.invalid/site.git",
      PUBLISH_WORKDIR: join(tmpdir(), "somewhere", ".git", "publish"),
    }),
  ).toThrow(/must not sit inside a git directory/);
});

test("a workdir that contains the workspace is refused before any checkout", () => {
  expect(() =>
    publishOptionsFromEnv({
      PUBLISH_APP: "shell",
      PUBLISH_BRANCH: branch,
      PUBLISH_REMOTE: "https://github.example.invalid/site.git",
      // Absolute, so it carries no `..` segment for the traversal check to
      // catch; the lane's `git clean -fd` would still reach the workspace.
      PUBLISH_WORKDIR: dirname(process.cwd()),
    }),
  ).toThrow(/is or contains the workspace/);
});

test("a runner may narrow how many times a lane races for the branch tip", () => {
  expect(
    publishOptionsFromEnv({
      PUBLISH_APP: "timeline",
      PUBLISH_BRANCH: branch,
      PUBLISH_REMOTE: "https://github.example.invalid/site.git",
      PUBLISH_ATTEMPTS: "2",
    }),
  ).toMatchObject({ attempts: 2 });
});

test("publish options default to the app's own build output", () => {
  expect(
    publishOptionsFromEnv({
      PUBLISH_APP: "timeline",
      PUBLISH_BRANCH: branch,
      PUBLISH_REMOTE: "https://github.example.invalid/site.git",
    }),
  ).toEqual({
    app: "timeline",
    source: "dist/apps/timeline",
    branch,
    remote: "https://github.example.invalid/site.git",
    workdir: ".publish-store",
    attempts: 5,
    retryDelayMs: 2000,
  });
});

test("every publishable lane is the shell or a registered remote", () => {
  expect(publishableApps).toContain("shell");
  expect(publishableApps).toHaveLength(13);
});

test.each([
  ["is not an object", ["awards"]],
  ["is empty", {}],
  [
    "names a remote that could not be a subtree path",
    { "../escape": "escape" },
  ],
  ["maps a remote to a non-string alias", { awards: 7 }],
])(
  "a remote registry that %s cannot define publish lanes",
  (_case, registry) => {
    expect(() => validatedRemoteRegistry(registry)).toThrow(
      /must map every remote's project name to a federation alias string/,
    );
  },
);

test("the committed remote registry defines every lane but the shell", () => {
  expect(Object.keys(validatedRemoteRegistry(remoteRegistry)).sort()).toEqual(
    publishableApps.filter((app) => app !== "shell").sort(),
  );
});
