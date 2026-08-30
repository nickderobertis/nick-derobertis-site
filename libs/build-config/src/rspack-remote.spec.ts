import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { z } from "zod";
import { remoteConfig, remoteMap } from "./rspack-remote";

// `@nx/rspack`'s app plugin reads the app it is configuring from the task
// environment Nx sets around a build, and normalizes the paths it was given
// against that project's root. Building a remote's configuration outside such
// a task is not something this function supports, so each case declares the
// build task it is standing in rather than asserting against a stand-in plugin.
function inBuildTaskFor(project: string) {
  process.env.NX_TASK_TARGET_PROJECT = project;
  process.env.NX_TASK_TARGET_TARGET = "build";
}

afterEach(() => {
  delete process.env.NX_TASK_TARGET_PROJECT;
  delete process.env.NX_TASK_TARGET_TARGET;
});

// Every remote is served from its own directory below the Pages project base,
// and a host reaches it through a `<alias>@<url>` entry. Both halves come from
// the same two committed inputs, so they are read here rather than restated.
const { pagesBase } = z
  .object({ pagesBase: z.string().regex(/^\/[a-z0-9-]+$/) })
  .parse(
    JSON.parse(
      readFileSync("libs/data-access-core/src/site.config.json", "utf8"),
    ),
  );

describe("federation remote map", () => {
  test("points each host entry at the remote's own published container", () => {
    expect(remoteMap(["awards", "timeline"])).toEqual({
      awards: `awards@${pagesBase}/remotes/awards/remoteEntry.js`,
      timeline: `timeline@${pagesBase}/remotes/timeline/remoteEntry.js`,
    });
  });

  test("resolves a hyphenated project to its camel-case federation alias", () => {
    expect(remoteMap(["home-cards"])).toEqual({
      homeCards: `homeCards@${pagesBase}/remotes/home-cards/remoteEntry.js`,
    });
  });

  test("composes nothing when a host declares no child remotes", () => {
    expect(remoteMap([])).toEqual({});
  });
});

describe("remote build configuration", () => {
  test("pins a remote's entry, public path, and exposed route boundary", () => {
    inBuildTaskFor("awards");
    const config = remoteConfig("awards", { skeleton: true });

    expect(config.entry).toBe("./apps/awards/src/main.tsx");
    // The declaration generator resolves each expose from the compiler's
    // context, which rspack captures when the compiler is constructed.
    expect(config.context).toBe(resolve("apps/awards"));
    expect(config.output).toMatchObject({
      publicPath: `${pagesBase}/remotes/awards/`,
      uniqueName: "awards",
    });
    const federation = config.plugins.at(-1);
    expect(federation).toMatchObject({
      _options: {
        name: "awards",
        filename: "remoteEntry.js",
        exposes: {
          "./Page": "./src/page.tsx",
          "./Skeleton": "./src/skeleton.tsx",
        },
        remotes: {},
      },
    });
  });

  test("exposes no skeleton for a remote no host renders one from", () => {
    inBuildTaskFor("bio");

    expect(remoteConfig("bio").plugins.at(-1)).toMatchObject({
      _options: { exposes: { "./Page": "./src/page.tsx" } },
    });
    // toMatchObject above cannot say a key is absent, and the plugin declares
    // its options as a private member, so reaching the exposes it was built
    // with is what lets the absence be asserted rather than assumed.
    // llmlint: ignore[suppressions_justified] The escape is necessary because `_options` is a private member of Module Federation's plugin, so no public type exposes it and there is nothing to narrow through; the assertion names only the one field the absence is asserted on. Dropping it would leave `not.toHaveProperty("./Skeleton")` unwritable, and toMatchObject above cannot say a key is absent -- so the assertion this whole test exists to make would become an assumption.
    expect(
      (
        remoteConfig("bio").plugins.at(-1) as unknown as {
          _options: { exposes: object };
        }
      )._options.exposes,
    ).not.toHaveProperty("./Skeleton");
  });

  test("compiles the exposes it declares into declarations for its hosts", () => {
    inBuildTaskFor("bio");

    expect(remoteConfig("bio").plugins.at(-1)).toMatchObject({
      _options: {
        dts: {
          generateTypes: {
            tsConfigPath: "tsconfig.app.json",
            generateAPITypes: false,
            deleteTypesFolder: false,
            abortOnError: true,
          },
          consumeTypes: false,
        },
      },
    });
  });

  test("gives a host the child remotes it was configured with", () => {
    inBuildTaskFor("home");
    const remotes = remoteMap(["awards"]);

    expect(remoteConfig("home", { remotes }).plugins.at(-1)).toMatchObject({
      _options: { name: "home", remotes },
    });
  });

  test("falls back to the project name when a build is not a registered remote", () => {
    inBuildTaskFor("shell");
    expect(remoteConfig("shell").plugins.at(-1)).toMatchObject({
      _options: { name: "shell" },
    });
  });
});
