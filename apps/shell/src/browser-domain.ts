// eslint-disable-next-line @nx/enforce-module-boundaries -- The shell owns site-base routing and reads only the base its own prerender wrote.
import { siteBase } from "@site/data-access-core/site";
// eslint-disable-next-line @nx/enforce-module-boundaries -- The shell validates route payloads at its loader boundary; feature apps never gain this data-core dependency.
import { validateCvDomain } from "@site/data-access-core/validators";

/**
 * Fetches one CV domain for a route loader. A failed status is refused before
 * the body is read, because a cache or gateway can answer a failed request with
 * a stale payload, and the schema is applied before the payload reaches a page.
 */
export async function loadBrowserDomain<
  Name extends "research" | "software_projects" | "courses",
>(name: Name) {
  const response = await fetch(`${siteBase}/cv-data/domains/${name}.json`);
  if (!response.ok)
    throw new Error(`${name} request failed: ${response.status}`);
  return validateCvDomain(name, await response.json());
}
