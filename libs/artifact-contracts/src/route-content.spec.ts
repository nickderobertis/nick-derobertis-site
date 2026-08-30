import { mkdirSync } from "node:fs";
import { copyFile, mkdtemp, rm, writeFile } from "node:fs/promises";
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

/**
 * A CV data root of this test's own, holding one domain file.
 *
 * The CV schema travels with the data in a staged root, so unless a test stages
 * one of its own, the fixture carries the schema the workspace publishes: what
 * these fixtures are held to is the contract the real artifact is held to.
 */
async function cvDataRoot(
  file: string,
  contents: string,
  schema?: string,
): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "route-content-"));
  fixtures.push(root);
  const target = path.join(root, file);
  mkdirSync(path.dirname(target), { recursive: true });
  await writeFile(target, contents);
  const stagedSchema = path.join(root, "cv.schema.json");
  if (schema === undefined)
    await copyFile(path.join(workspaceCvData, "cv.schema.json"), stagedSchema);
  else await writeFile(stagedSchema, schema);
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
        { id: "one", name: "pypi-name", display_name: "Displayed Project" },
        { id: "two", name: "unnamed-package" },
        { id: "three", name: "", display_name: null },
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

  // Every case below is what a visitor would have been shown had the domain
  // been read field by field instead: a course list that is not a list, an
  // entry the CV schema does not admit, a domain that is not a document at all.
  // Each is refused where the data enters, naming the file and what the schema
  // rejected in it, rather than silently asserting nothing about the route.
  test.each([
    [
      "a domain that is not a list of entries",
      "/courses",
      "domains/courses.json",
      "{}",
      "must be array",
    ],
    [
      "a domain whose entries carry no title",
      "/courses",
      "domains/courses.json",
      '[{"code":"FIN 4934"}]',
      "must have required property 'title'",
    ],
    [
      "a domain listing something that is not an entry",
      "/courses",
      "domains/courses.json",
      '["Financial Modeling"]',
      "must be object",
    ],
    [
      "a research domain that is not a document at all",
      "/research",
      "domains/research.json",
      "null",
      "must be object",
    ],
  ])(
    "refuses %s rather than asserting nothing",
    async (_case, route, file, contents, rejection) => {
      const root = await cvDataRoot(file, contents);

      expect(() => routeSubstantiveContent(root, route)).toThrow(
        `${file} is not a valid`,
      );
      expect(() => routeSubstantiveContent(root, route)).toThrow(rejection);
    },
  );

  test.each([
    [
      "a courses domain listing nothing",
      "/courses",
      "domains/courses.json",
      "[]",
    ],
    [
      "a research domain carrying no projects",
      "/research",
      "domains/research.json",
      "{}",
    ],
  ])(
    "refuses %s, which conforms but titles nothing",
    async (_case, route, file, contents) => {
      const root = await cvDataRoot(file, contents);

      expect(() => routeSubstantiveContent(root, route)).toThrow(
        `carries no titles for ${route}`,
      );
    },
  );

  test("refuses a staged CV schema that defines no such domain", async () => {
    const root = await cvDataRoot("domains/courses.json", "[]", "{}");

    expect(() => routeSubstantiveContent(root, "/courses")).toThrow(
      /cv\.schema\.json defines no courses domain to validate/,
    );
  });

  // A staged schema is the whole contract the domain beside it is held to, so
  // one that carries its definitions inline validates on its own terms.
  test("validates a staged domain against the staged schema's own definitions", async () => {
    const root = await cvDataRoot(
      "domains/courses.json",
      '[{"id":"fin","title":"Staged Course"}]',
      JSON.stringify({
        properties: {
          courses: {
            type: "array",
            items: {
              type: "object",
              properties: { id: { type: "string" }, title: { type: "string" } },
              required: ["id", "title"],
            },
          },
        },
      }),
    );

    expect(routeSubstantiveContent(root, "/courses")).toEqual([
      "Staged Course",
    ]);
  });
});
