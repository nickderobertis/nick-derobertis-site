import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { serializeFragmentContract } from "./fragment-contract";
import {
  assertOwnSubtree,
  contentStoreNoticePath,
  publishableApps,
  publishFragment,
  publishOptionsFromEnv,
  validatedRemoteRegistry,
} from "./publish-fragment";
import remoteRegistry from "./remotes.json";

const branch = "published-fragments";
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
  "the content store may not be the %s branch GitHub Pages could serve",
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
    "too many attempts",
    { PUBLISH_ATTEMPTS: "99" },
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
