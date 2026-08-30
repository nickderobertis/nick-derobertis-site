import { readFile } from "node:fs/promises";
import type { ServerResponse } from "node:http";
import { join } from "node:path";

/** The CV domains a browser journey can steer into a non-happy state. */
const scenarioDomains: ReadonlyArray<string> = ["research", "awards"];
const scenarios = ["empty", "error", "loading", "schema-invalid"];

export interface E2eDataRequest {
  /** The Pages base path the site is served under, without a trailing slash. */
  base: string;
  /** How long a `?scenario=loading` request is held before it resolves. */
  loadingMs: number;
  response: ServerResponse;
  /** The artifact root the happy-path fixtures are read from. */
  root: string;
  url: URL;
}

/**
 * Answers the CV-data requests a browser journey steers with `?scenario=`,
 * reporting whether it owned the request so a caller can fall through to its
 * static files. Every other request is left untouched.
 */
export async function handleE2eDataRequest({
  base,
  loadingMs,
  response,
  root,
  url,
}: E2eDataRequest): Promise<boolean> {
  const dataDomain = scenarioDomains.find(
    (domain) => url.pathname === `${base}/cv-data/domains/${domain}.json`,
  );
  if (!dataDomain) return false;
  const scenario = url.searchParams.get("scenario");
  if (scenario !== null && !scenarios.includes(scenario)) {
    response.writeHead(400).end("Unsupported e2e data scenario");
    return true;
  }
  if (scenario === "loading")
    await new Promise((resolve) => setTimeout(resolve, loadingMs));
  if (scenario === "error") {
    response
      .writeHead(503, { "Content-Type": "application/json" })
      .end(JSON.stringify({ error: `${dataDomain} unavailable` }));
    return true;
  }
  if (scenario === "schema-invalid") {
    // A degraded or stale data host can answer 200 with something that is not
    // the domain at all. That is the answer a pane's schema check exists for,
    // and serving it here is what lets a journey reach that state through the
    // site's own URL rather than from inside the browser.
    response
      .writeHead(200, { "Content-Type": "application/json" })
      .end(
        JSON.stringify(
          dataDomain === "research" ? { projects: [{ id: 42 }] } : [{ id: 42 }],
        ),
      );
    return true;
  }
  if (scenario === "empty") {
    response
      .writeHead(200, { "Content-Type": "application/json" })
      .end(JSON.stringify(dataDomain === "research" ? { projects: [] } : []));
    return true;
  }
  // llmlint: ignore[boundary_inputs_validated] Not a trust boundary: this is the artifact this workspace just composed, under a root the caller named, and serving it byte for byte is the point — the journeys downstream assert each pane's own validator over exactly these bytes, so validating them here would hide the answer that matters. An unreadable one is reported below with the path and the target to rerun.
  try {
    // Read before answering: writing the status line first would leave a failed
    // read unable to report itself, because the headers are already sent.
    const fixture = await readFile(
      join(root, `cv-data/domains/${dataDomain}.json`),
    );
    response
      .writeHead(200, { "Content-Type": "application/json" })
      .end(fixture);
  } catch (error) {
    console.error(
      `e2e-data-provider: unable to read ${dataDomain} fixture: ${error instanceof Error ? error.message : String(error)}; run the shell prerender target and retry`,
    );
    response
      .writeHead(500, { "Content-Type": "application/json" })
      .end(JSON.stringify({ error: `${dataDomain} fixture unavailable` }));
  }
  return true;
}
