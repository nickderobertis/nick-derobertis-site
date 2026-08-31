import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  appSourceModules,
  cvDataReachableFrom,
  cvPayloadFiles,
} from "./cv-data-reachability.mjs";

/**
 * Which CV data a feature can reach at all, read out of the module graph its
 * build compiles rather than out of the bytes that build emitted.
 *
 * The bundle budgets beside this file hold a payload to a ceiling, and the
 * artifact gate sweeps the composed output for CV content. Neither says a
 * domain is *unreachable*: a ceiling is a size, and a sweep is a sample of
 * strings, so a domain that arrived in a chunk minified, re-encoded or merely
 * unsampled passes both. This asks the question the other two cannot — which
 * committed CV file each feature's own modules can follow an import to — so a
 * domain that is not among them is one no chunk of that app can hold.
 */

/**
 * The domain each feature reads. `software` is the one place the two names
 * differ: the CV calls the domain `software_projects`.
 */
const featureDomains = {
  courses: "courses",
  research: "research",
  skills: "skills",
  software: "software_projects",
  timeline: "timeline",
};

/**
 * The library each feature reads that domain through, and the domain file its
 * own module graph must reach — exactly one, and its own.
 */
const featureLibraries = {
  courses: "data-access-courses",
  research: "data-access-research",
  skills: "data-access-skills",
  software: "data-access-software",
  timeline: "data-access-timeline",
};

// `Object.keys` is typed `string[]` because a value can carry keys its type does
// not declare. This object is the literal above and carries no others, so the
// assertion narrows back to what that literal already says rather than claiming
// anything the compiler cannot see.
const features = Object.keys(featureDomains) as (keyof typeof featureDomains)[];

function domainFile(domain: string) {
  return `libs/data-access-core/vendor/codegen/domains/${domain}.json`;
}

/**
 * The module rspack is configured to build an app from, taken from that app's
 * own project.json rather than restated here, so the walk below is anchored to
 * the entry the real build compiles.
 */
const buildMainSchema = z.object({
  targets: z.object({
    build: z.object({ options: z.object({ main: z.string() }) }),
  }),
});

function declaredBuildMain(app: string) {
  return buildMainSchema.parse(
    JSON.parse(readFileSync(join("apps", app, "project.json"), "utf8")),
  ).targets.build.options.main;
}

describe("what CV data each feature's build graph can reach", () => {
  it("walks the entry the app's own build declares", () => {
    for (const app of features)
      expect(appSourceModules(app)).toContain(declaredBuildMain(app));
  });

  it.each(features)(
    "gives %s its own domain file and no other CV data",
    (app) => {
      const reached = cvDataReachableFrom(appSourceModules(app));

      expect(reached.payloadFiles).toEqual([domainFile(featureDomains[app])]);
    },
  );

  it.each(features)("reaches it through the %s domain library", (app) => {
    const reached = cvDataReachableFrom(appSourceModules(app));

    expect(reached.files).toContain(
      `libs/${featureLibraries[app]}/src/data.ts`,
    );
  });

  it("gives the Start-prerendered awards pane only its own CV data", () => {
    // Start renders Awards during its build, so the route imports the committed
    // slice as validated loader data. The browser still refreshes that initial
    // value from the published slice when a scenario query is present.
    expect(
      cvDataReachableFrom(appSourceModules("awards")).payloadFiles,
    ).toEqual([domainFile("awards")]);
  });

  it("still finds all seven files where they really are", () => {
    // The bundled client is what the five features used to read, and it imports
    // the aggregate and every domain. Finding all of them is what says an empty
    // result above is a graph that holds no CV data rather than a walk that
    // sees none.
    const reached = cvDataReachableFrom([
      "libs/data-access-core/src/bundled.ts",
    ]);

    expect(reached.payloadFiles).toEqual(cvPayloadFiles());
    expect(reached.payloadFiles).toHaveLength(7);
  });

  it.each(features)(
    "carries only the %s domain into the library that publishes it",
    (app) => {
      const reached = cvDataReachableFrom([
        `libs/${featureLibraries[app]}/src/index.ts`,
      ]);

      expect(reached.payloadFiles).toEqual([domainFile(featureDomains[app])]);
    },
  );
});
