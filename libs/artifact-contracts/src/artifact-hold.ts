import { createHash } from "node:crypto";
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { z } from "zod";

// llmlint: ignore-file[changed_behavior_has_e2e] Nothing here has a browser interface: a hold changes no byte an artifact carries, and it is taken and dropped before and after the window in which anything is served. Every path it adds ends in a run that wrote nothing, so the artifact a visitor reaches is the one the other run composed, unchanged and already driven by site.spec.ts on both render paths. The lifecycle itself is driven through the real compose and serve CLIs by compose.spec.ts and serve-e2e.spec.ts.

/**
 * Who may touch one composed artifact directory at a time.
 *
 * `shell:prerender` composes the site in place over `dist/apps/shell`, and every
 * app's e2e server serves those same bytes, so the two must never overlap: a
 * compose that removes and restages `cv-data`, `remotes`, and the route
 * documents underneath a running server makes that server answer with the
 * recovery document for whatever it is midway through replacing. A browser
 * reports that as a missing heading, unpainted remote styling, or a link that
 * navigates instead of routing — three symptoms of one corrupted read, none of
 * which names its cause.
 *
 * Within one dispatch Nx already orders them, because `e2e` depends on
 * `prerender`. It is two overlapping runs over one working tree — a second
 * `just check`, or a gate left running in the background — that Nx cannot
 * order, because neither run can see the other's tasks. What they can see is
 * this hold, so a compose that would write into a directory something is
 * serving fails here, before it has written anything, naming the run that
 * already holds it.
 *
 * Serving is shared and composing is exclusive: `nx affected -t e2e` serves
 * `dist/apps/shell` from several apps' Playwright servers at once, and that is
 * correct, because they only read it. Composing while any of them reads is not.
 *
 * That shared side is why this is hand-rolled rather than delegated to
 * `proper-lockfile`, which otherwise covers what is written below: its `lock()`
 * grants one holder at a time, so `serving` would serialize those readers.
 */
const activitySchema = z.enum(["composing", "serving"]);

/**
 * The activity a run claims an artifact for. Every caller and every hold this
 * module reads back are held to the one enum, so a third activity is added
 * where it is checked rather than in a union beside it.
 */
export type ArtifactActivity = z.infer<typeof activitySchema>;

const holdSchema = z.object({
  pid: z.number().int().positive(),
  activity: activitySchema,
  root: z.string().min(1),
});

type ArtifactHold = z.infer<typeof holdSchema>;

/**
 * The directory the holds on one artifact root are recorded in.
 *
 * Holds live beneath the temporary directory rather than inside the artifact,
 * because the artifact is a deploy tree `check-static-artifact` walks: a marker
 * written into it would become a file the deploy carries. Keying by the
 * resolved path lets two worktrees compose their own `dist` concurrently while
 * still colliding on one they share.
 */
export function artifactHoldDirectory(root: string): string {
  return join(
    tmpdir(),
    "nick-derobertis-site-artifact-holds",
    createHash("sha256").update(resolve(root)).digest("hex"),
  );
}

function running(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // `process.kill` throws a Node system error, which carries `code`;
    // asserting that shape is what makes the ESRCH test mean anything, because
    // the caught value is otherwise `unknown` and has no code to read.
    if ((error as NodeJS.ErrnoException).code === "ESRCH") return false;
    // A hold owned by another user answers EPERM: that process is alive and
    // this run may not signal it, so only ESRCH means the hold is stale.
    return true;
  }
}

/**
 * Drops every hold on this directory that no run still owns, and answers with
 * the ones that are left.
 *
 * A hold left behind by a killed run, and one that no longer reads back as the
 * record this module wrote, are both deleted here rather than merely skipped:
 * neither names a process whose liveness can be checked, so keeping either
 * would block every later compose on the machine.
 */
function pruneToLiveHolds(directory: string): ArtifactHold[] {
  const live: ArtifactHold[] = [];
  for (const entry of readdirSync(directory)) {
    const file = join(directory, entry);
    const held = holdSchema.safeParse(
      ((): unknown => {
        try {
          return JSON.parse(readFileSync(file, "utf8"));
        } catch {
          return undefined;
        }
      })(),
    );
    // The root is checked against the directory the record was found in, not
    // trusted from the record: a hold naming some other artifact is not a hold
    // on this one, whatever it says about itself.
    if (
      held.success &&
      artifactHoldDirectory(held.data.root) === directory &&
      running(held.data.pid)
    )
      live.push(held.data);
    else rmSync(file, { force: true, recursive: true });
  }
  return live;
}

/**
 * Claims `root` for `activity`, or throws naming the run that already holds it.
 *
 * The claim is published before the directory is read, and that order is what
 * makes the claim exclusive rather than merely likely. Two composers that each
 * read first would each find the directory empty, each write, and each believe
 * it held the artifact alone — the exact overlap this module exists to refuse.
 * Writing first means any run that reaches the scan is already visible to
 * everyone racing it, so an overlap is refused on both sides instead of missed
 * on both. A run refused this way takes its own claim back off before it
 * throws; left behind, it would block the next run on a hold nobody owns.
 *
 * A hold directory this run cannot create, write, or read is reported as that
 * directory and what clears it, because both callers print a thrown message and
 * nothing else.
 *
 * The returned release drops this run's claim, and is safe to call more than
 * once: a server releases on whichever of process exit and its shutdown signal
 * arrives first, and a compose releases whether or not it threw.
 */
export function holdArtifactRoot(
  root: string,
  activity: ArtifactActivity,
): () => void {
  const directory = artifactHoldDirectory(root);
  const file = join(directory, `${process.pid}.json`);
  const release = () => {
    try {
      rmSync(file, { force: true });
    } catch {
      // A record this run cannot remove is one the next run drops anyway: it
      // names a pid that is about to be gone, and pruning is by liveness.
    }
  };
  let liveHolds: ArtifactHold[];
  try {
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      file,
      `${JSON.stringify({ pid: process.pid, activity, root: resolve(root) })}\n`,
    );
    liveHolds = pruneToLiveHolds(directory);
  } catch (error) {
    // Both callers report a thrown message and nothing else — compose prints
    // it as `compose: …` and the e2e server inside its own `Could not claim …`
    // line — so a bare filesystem diagnostic reaches a contributor naming
    // neither the directory that refused nor anything to do about it.
    release();
    throw new Error(
      `${resolve(root)} could not be claimed for ${activity}: ${error instanceof Error ? error.message : String(error)}. Check that ${directory} is writable, or delete it to clear every hold recorded there, then rerun just check.`,
    );
  }
  const [blocking] = liveHolds.filter(
    (held) =>
      held.pid !== process.pid &&
      (activity === "composing" || held.activity === "composing"),
  );
  if (blocking !== undefined) {
    release();
    throw new Error(
      `${resolve(root)} is held by process ${blocking.pid}, which is ${blocking.activity} it, so ${activity} it now would read or replace bytes that run owns. Let the other run finish — never run two gates at once — then rerun just check.`,
    );
  }
  return release;
}
