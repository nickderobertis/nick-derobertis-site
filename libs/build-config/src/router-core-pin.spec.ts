import { readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { expect, test } from "vitest";
import { z } from "zod";

/**
 * The drift gate over the `@tanstack/router-core` pin.
 *
 * `shell-fragment-entry.tsx` drives `router.serverSsr`, which router-core's own
 * declarations annotate "Framework-only". That surface does not live in the
 * exactly pinned `@tanstack/react-router`, so the workspace declares
 * `@tanstack/router-core` itself — and a declared version is a second statement
 * of something the package manager was already resolving, which is exactly the
 * kind of restatement that drifts. Two things keep it from drifting: the
 * declared version has to be the version that is installed, and the copy it
 * names has to be the copy `@tanstack/react-router` itself loads. Without the
 * second, a react-router upgrade that moves its own router-core requirement
 * leaves the declaration pinning a package nothing renders with, while the
 * entry keeps driving whichever copy react-router resolved — the private
 * surface moving underneath a pin, which is the failure the pin exists to stop.
 *
 * This gate lives beside the entry rather than with the workspace's manifest
 * contracts because it is that entry's dependency on a framework-only API that
 * makes the declaration necessary at all.
 */
const installedPackage = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
});

const workspaceManifest = z.object({
  dependencies: z.record(z.string(), z.string()),
});

// Resolution starts from this file, so what it finds is what an import in this
// library finds — the same walk the entry's own `@tanstack/*` imports take.
const resolver = createRequire(
  join(import.meta.dirname, "router-core-pin.spec.ts"),
);

const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(path, "utf8"));

const installedVersion = (specifier: string) =>
  installedPackage.parse(
    readJson(resolver.resolve(`${specifier}/package.json`)),
  ).version;

test("the workspace declares @tanstack/router-core at the version it installs", () => {
  const { dependencies } = workspaceManifest.parse(
    readJson(resolve(import.meta.dirname, "../../../package.json")),
  );

  expect(
    dependencies["@tanstack/router-core"],
    "package.json declares a @tanstack/router-core version the install does not produce. Set that dependency to the exact version pnpm resolves, and commit the lockfile with it.",
  ).toBe(installedVersion("@tanstack/router-core"));
});

test("@tanstack/react-router loads the pinned copy of @tanstack/router-core", () => {
  const reactRouter = resolver.resolve("@tanstack/react-router/package.json");

  expect(
    realpathSync(
      createRequire(reactRouter).resolve("@tanstack/router-core/package.json"),
    ),
    `@tanstack/react-router ${installedVersion("@tanstack/react-router")} resolves a different copy of @tanstack/router-core than the workspace pins, so the shell fragment entry drives a serverSsr the pin does not describe. Move the declared @tanstack/router-core to the version react-router depends on, or drop it and pin react-router to a release that keeps this one.`,
  ).toBe(realpathSync(resolver.resolve("@tanstack/router-core/package.json")));
});
