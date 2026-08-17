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
 */
export type ArtifactActivity = "composing" | "serving";

const holdSchema = z.object({
  pid: z.number().int().positive(),
  activity: z.enum(["composing", "serving"]),
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

/**
 * Whether the process that wrote a hold is still running.
 */
function running(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") return false;
    // A hold owned by another user answers EPERM: that process is alive and
    // this run may not signal it, so only ESRCH means the hold is stale.
    return true;
  }
}

/**
 * Every hold on this directory whose owner is still running.
 *
 * A hold left behind by a killed run, and one that no longer reads back as the
 * record this module wrote, are both removed: neither names a process whose
 * liveness can be checked, so keeping either would block every later compose on
 * the machine.
 */
function liveHolds(directory: string): ArtifactHold[] {
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
    if (held.success && running(held.data.pid)) live.push(held.data);
    else rmSync(file, { force: true, recursive: true });
  }
  return live;
}

/**
 * Claims `root` for `activity`, or throws naming the run that already holds it.
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
  mkdirSync(directory, { recursive: true });
  const [blocking] = liveHolds(directory).filter(
    (held) =>
      held.pid !== process.pid &&
      (activity === "composing" || held.activity === "composing"),
  );
  if (blocking !== undefined)
    throw new Error(
      `${resolve(root)} is held by process ${blocking.pid}, which is ${blocking.activity} it, so ${activity} it now would read or replace bytes that run owns. Let the other run finish — never run two gates at once — then rerun just check.`,
    );
  const file = join(directory, `${process.pid}.json`);
  writeFileSync(
    file,
    `${JSON.stringify({ pid: process.pid, activity, root: resolve(root) })}\n`,
  );
  return () => rmSync(file, { force: true });
}
