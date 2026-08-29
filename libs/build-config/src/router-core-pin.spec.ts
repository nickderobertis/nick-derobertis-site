import { readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { expect, test } from "vitest";
import { z } from "zod";

/**
 * The drift gate over the `@tanstack/router-core` pin, which exists because
 * `shell-fragment-entry.tsx` drives that package's framework-only `serverSsr`
 * and `@tanstack/react-router` does not carry it. It is declared as a direct
 * dependency rather than a `pnpm.overrides` entry because AGENTS.md holds every
 * dependency's `pnpm outdated` `current` to its `wanted`, and only a declared
 * one is reported there. A react-router upgrade that moved its own router-core
 * requirement would leave that declaration pinning a copy nothing renders with,
 * so both halves are asserted below.
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
