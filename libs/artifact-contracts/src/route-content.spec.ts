import { mkdirSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import { routeSubstantiveContent } from "./route-content.ts";

/** The CV data the workspace builds from, which compose stages as `cv-data`. */
const workspaceCvData = "libs/data-access-core/vendor/codegen";
const fixtures: string[] = [];

afterAll(async () => {
  for (const fixture of fixtures.splice(0))
    await rm(fixture, { recursive: true, force: true });
});

/** A CV data root of this test's own, holding one domain file. */
async function cvDataRoot(file: string, contents: string): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "route-content-"));
  fixtures.push(root);
  const target = path.join(root, file);
  mkdirSync(path.dirname(target), { recursive: true });
  await writeFile(target, contents);
  return root;
}

describe("substantive route content", () => {
  test.each([
    ["/", "Who am I?"],
    ["/bio", "Reproducible Research"],
  ])("gives %s the prose its own remote writes", (route, prose) => {
    expect(routeSubstantiveContent(workspaceCvData, route)).toEqual([prose]);
  });

  test.each(["/research", "/software", "/courses"])(
    "reads every title %s renders out of the CV data itself",
    (route) => {
      const titles = routeSubstantiveContent(workspaceCvData, route);

      expect(titles.length).toBeGreaterThan(0);
      for (const title of titles) expect(title).not.toBe("");
    },
  );

  test("titles a software project by its display name, or else its package name", async () => {
    const root = await cvDataRoot(
      "domains/software_projects.json",
      JSON.stringify([
        { name: "pypi-name", display_name: "Displayed Project" },
        { name: "unnamed-package" },
        { name: "" },
      ]),
    );

    expect(routeSubstantiveContent(root, "/software")).toEqual([
      "Displayed Project",
      "unnamed-package",
    ]);
  });

  test("refuses a route with neither prose nor a CV domain of its own", () => {
    expect(() => routeSubstantiveContent(workspaceCvData, "/talks")).toThrow(
      /\/talks has no substantive content to check/,
    );
  });

  test("names the CV data it could not read", () => {
    expect(() =>
      routeSubstantiveContent("nowhere/on/disk", "/courses"),
    ).toThrow(/Could not read the CV data at nowhere\/on\/disk/);
  });

  test.each([
    ["a domain that is not a list of entries", "{}"],
    ["a domain whose entries carry no title", '[{"code":"FIN 4934"}]'],
    [
      "a domain listing something that is not an entry",
      '["Financial Modeling"]',
    ],
  ])("refuses %s rather than asserting nothing", async (_case, contents) => {
    const root = await cvDataRoot("domains/courses.json", contents);

    expect(() => routeSubstantiveContent(root, "/courses")).toThrow(
      /carries no titles for \/courses/,
    );
  });

  test("refuses a research domain that is not a document at all", async () => {
    const root = await cvDataRoot("domains/research.json", "null");

    expect(() => routeSubstantiveContent(root, "/research")).toThrow(
      /carries no titles for \/research/,
    );
  });
});
