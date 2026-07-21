import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function handleE2eDataRequest({
  base,
  loadingMs,
  response,
  root,
  url,
}) {
  const dataDomain = ["research", "awards"].find(
    (domain) => url.pathname === `${base}/cv-data/domains/${domain}.json`,
  );
  if (!dataDomain) return false;
  const scenario = url.searchParams.get("scenario");
  if (scenario !== null && !["empty", "error", "loading"].includes(scenario)) {
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
  if (scenario === "empty") {
    response
      .writeHead(200, { "Content-Type": "application/json" })
      .end(JSON.stringify(dataDomain === "research" ? { projects: [] } : []));
    return true;
  }
  try {
    response
      .writeHead(200, { "Content-Type": "application/json" })
      .end(await readFile(join(root, `cv-data/domains/${dataDomain}.json`)));
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
