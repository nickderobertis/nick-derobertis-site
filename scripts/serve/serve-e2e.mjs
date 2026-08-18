import { fileURLToPath } from "node:url";
import { holdArtifactRoot } from "@site/artifact-contracts/artifact-hold";
import siteConfig from "@site/data-access-core/site.config.json" with {
  type: "json",
};
import { closeOnSignals, createSiteServer } from "@site/e2e-fixtures";

process.on("uncaughtException", (error) => {
  console.error(
    `serve-e2e: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});

function validateSiteConfig(value) {
  if (
    !value ||
    typeof value !== "object" ||
    typeof value.pagesBase !== "string" ||
    !/^\/[a-z0-9-]+$/.test(value.pagesBase)
  )
    throw new Error(
      `site.config.json pagesBase must match /[a-z0-9-]+; received ${JSON.stringify(value?.pagesBase)}. Fix it and run just test-e2e again.`,
    );
  return value;
}

const root = fileURLToPath(new URL("../../dist/apps/shell", import.meta.url));
const base = validateSiteConfig(siteConfig).pagesBase;
// llmlint: ignore-block[changed_behavior_has_e2e] Server startup validation is exercised through the real serve-e2e subprocess in home.spec.ts; it occurs before a browser interface exists.
const portValue = process.env.PORT ?? "4200";
const port = Number(portValue);
if (!Number.isInteger(port) || port < 1 || port > 65_535)
  throw new Error(
    `PORT must be an integer from 1 to 65535; received ${JSON.stringify(portValue)}. Set a valid PORT and run just test-e2e again.`,
  );
// llmlint: ignore-end[changed_behavior_has_e2e]
const server = createSiteServer({
  base,
  // A `?scenario=loading` domain stays pending long enough for a journey to
  // assert the loading state before its data arrives. The window matches the
  // 1500ms every previewed loading state holds itself open for, with room for
  // the request a pane only makes once its own page code has arrived.
  dataLoadingMs: 2_000,
  // The one remote a journey names through `?hold-remote-code=` keeps its page
  // code pending for the whole journey, so a host-composed skeleton can be
  // watched without racing whichever of the load and the host's warm lands
  // first.
  holdRemoteCodeMs: 3_000,
  // Every other remote's lazily loaded page code arrives late enough for a
  // journey to observe the skeleton it replaces, which is the state those
  // journeys assert.
  lazyAssetLatencyMs: 300,
  notFound: { file: "404.html" },
  root,
});
// Several apps' e2e runs serve this one composed artifact at once, which is
// only ever reading it. Claiming it as a reader is what makes a compose started
// by a second, overlapping run refuse rather than replace these bytes midway
// through the journey reading them.
// llmlint: ignore-block[changed_behavior_has_e2e] This claim has no browser interface: it changes no byte the server answers with and is taken before it listens, so a browser cannot tell a held artifact from an unheld one, and a refused claim serves nothing for a browser to reach. What it protects is exactly what the browser journeys assert — serve-e2e.spec.ts drives this real CLI against the real compose CLI over one artifact, through both the claim it takes and the claim it is refused, and site.spec.ts plus every feature journey drive that artifact's routes on both render paths.
// A refused claim is this server declining to start, so it is reported here
// rather than left to the catch-all above: only this site knows the artifact
// that was refused and that `just test-e2e` is the command an operator reaches
// it again through. Nothing is listening yet, so the process leaves rather than
// serving bytes another run owns.
const release = (() => {
  try {
    return holdArtifactRoot(root, "serving");
  } catch (error) {
    console.error(
      `Could not claim ${root} for the e2e server: ${error instanceof Error ? error.message : String(error)} Nothing was served; clear what that names, then run just test-e2e again.`,
    );
    return process.exit(1);
  }
})();
// llmlint: ignore-end[changed_behavior_has_e2e]
process.on("exit", release);
// llmlint: ignore-block[changed_behavior_has_e2e] Listen failures are exercised through the real serve-e2e subprocess with an occupied port in home.spec.ts; no browser can connect in this state.
server.on("error", (error) => {
  console.error(
    `Could not start the e2e server on port ${port}: ${error.message}. Choose an available PORT and run just test-e2e again.`,
  );
  process.exitCode = 1;
});
server.listen(port, "127.0.0.1");
// llmlint: ignore-end[changed_behavior_has_e2e]

closeOnSignals(server, ["SIGINT", "SIGTERM"], (error) => {
  console.error(
    `Could not stop the e2e server cleanly: ${error.message}. Ensure no requests are stuck, then rerun just test-e2e.`,
  );
  process.exitCode = 1;
});
