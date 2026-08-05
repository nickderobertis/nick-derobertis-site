import {
  publishFragment,
  publishOptionsFromEnv,
} from "../../libs/build-config/src/publish-fragment.ts";

// One publish lane: write this app's already-built bytes to its own subtree on
// the content-store branch and nothing else. The compose-and-deploy lane reads
// that branch; this step never touches the Pages artifact.
//
// llmlint: ignore-file[changed_behavior_has_e2e] This publish CLI has no browser interface: it moves built bytes between a build directory and a git branch, so its success and failure paths are only observable as stdout and an exit status. publish-fragment.spec.ts drives the API it wraps against a real local bare repository, including the non-fast-forward recovery path, and the bytes it stores are driven through the browser by site.spec.ts and every feature journey once the compose lane assembles them.
try {
  const result = await publishFragment(publishOptionsFromEnv(process.env));
  process.stdout.write(
    `${result.changed ? "published" : "unchanged"} ${result.app} on ${result.branch} at ${result.commit ?? "unknown"} after ${result.attempts} attempt(s)\n`,
  );
} catch (error) {
  // Every message this can carry already names what to correct; add where the
  // operator acts, because a lane failure is read in a CI log with no context.
  // PUBLISH_APP is deliberately not named here: this handler also catches the
  // validation that would have rejected it, so it is not a value to echo back.
  console.error(
    `publish-fragment: ${error instanceof Error ? error.message : String(error)}\npublish-fragment: nothing was written to the content-store branch, so this lane's app still serves its last published bytes. Fix the cause above and rerun this lane; the compose-and-deploy lane needs no change.`,
  );
  process.exit(1);
}
