// eslint-disable-next-line @nx/enforce-module-boundaries -- The shell owns this route-loader boundary; its spec serves the same CV domains the deployed loaders fetch.
import { cvDataClient } from "@site/data-access-core";
import { afterEach, expect, test, vi } from "vitest";
import { loadBrowserDomain } from "./browser-domain";

const requested: string[] = [];

/**
 * Stands in for the Pages host that serves the CV domains — the only boundary
 * a route loader has. Everything below it is the real validator.
 */
function serveDomain(body: unknown, status = 200) {
  vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
    requested.push(String(input));
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  });
}

afterEach(() => {
  requested.length = 0;
  vi.unstubAllGlobals();
});

test("loads a CV domain from the path the deployed site serves it at", async () => {
  const courses = cvDataClient.domain("courses");
  serveDomain(courses);

  await expect(loadBrowserDomain("courses")).resolves.toEqual(courses);

  expect(requested).toEqual([
    "/nick-derobertis-site/cv-data/domains/courses.json",
  ]);
});

test("refuses a body the server itself reported as a failure", async () => {
  // A cache or gateway can answer a failed request with the last payload it
  // held, so the status is the only thing saying this is not the answer.
  serveDomain(cvDataClient.domain("research"), 503);

  await expect(loadBrowserDomain("research")).rejects.toThrow(
    "research request failed: 503",
  );
});

test("refuses a payload that does not match the CV schema", async () => {
  serveDomain([{ name: "not a software project" }]);

  await expect(loadBrowserDomain("software_projects")).rejects.toThrow();
});
