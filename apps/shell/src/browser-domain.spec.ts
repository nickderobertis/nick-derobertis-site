// eslint-disable-next-line @nx/enforce-module-boundaries -- The shell owns this route-loader boundary; its spec serves the same CV domains the deployed loaders fetch.
import { cvDataClient } from "@site/data-access-core/bundled";
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

test("refuses a failed response without reading its body", async () => {
  // The body of a failed response is not an answer, so nothing here may read
  // it. This one refuses to be read, and counts the attempt, so a loader that
  // reached for it fails on that rather than on the status the server sent.
  let bodyReads = 0;
  const refuseBody = () => {
    bodyReads += 1;
    return Promise.reject(new Error("the failed body was read"));
  };
  vi.stubGlobal("fetch", async () =>
    Object.assign(
      new Response(JSON.stringify(cvDataClient.domain("courses")), {
        status: 503,
        headers: { "content-type": "application/json" },
      }),
      { json: refuseBody, text: refuseBody },
    ),
  );

  await expect(loadBrowserDomain("courses")).rejects.toThrow(
    "courses request failed: 503",
  );
  expect(bodyReads).toBe(0);
});

test("refuses a payload that does not match the CV schema", async () => {
  serveDomain([{ name: "not a software project" }]);

  await expect(loadBrowserDomain("software_projects")).rejects.toThrow();
});
