// eslint-disable-next-line @nx/enforce-module-boundaries -- This spec drives the build-only shell fragment entry, which reads the CV data through this same client; nothing in the library runtime gains the dependency.
import { siteBase } from "@site/data-access-core";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { renderShellFragment } from "./shell-fragment-entry";
import { failRenderingRoute } from "./shell-fragment-router.fixture";
import { routes } from "./shell-fragment-routes.fixture";

/**
 * The SSR lifecycle steps the entry drives, in the order it drives them.
 * `cleanup <path>` is recorded by a wrapper installed on the real router's
 * framework-only `serverSsr` before the entry's render callback runs, and
 * `settled <path>` when that callback returns or throws.
 *
 * The order of that pair is what says who owns the step. router-core's own
 * request handler cleans up in a `finally` that runs after the callback
 * settles, so `settled` before `cleanup` is the entry having left cleanup to
 * whatever the framework happens to do — the drift this spec exists to catch.
 * `cleanup` before `settled` is the entry running it itself.
 */
const { lifecycle } = vi.hoisted((): { lifecycle: string[] } => ({
  lifecycle: [],
}));

vi.mock("@tanstack/react-router/ssr/server", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@tanstack/react-router/ssr/server")>();
  // The real handler, the real router and the real SSR utils: the only thing
  // added is the recording, so what the entry drives here is what it drives in
  // the publish build.
  const createRequestHandler: typeof actual.createRequestHandler = (
    options,
  ) => {
    const handle = actual.createRequestHandler(options);
    return (callback) =>
      handle(async (context) => {
        const path = new URL(context.request.url).pathname;
        const serverSsr = context.router.serverSsr;
        if (serverSsr) {
          const cleanup = serverSsr.cleanup.bind(serverSsr);
          serverSsr.cleanup = () => {
            lifecycle.push(`cleanup ${path}`);
            cleanup();
          };
        }
        try {
          return await callback(context);
        } finally {
          lifecycle.push(`settled ${path}`);
        }
      });
  };
  return { ...actual, createRequestHandler };
});

const cleanupThenSettle = (path: string) => [
  `cleanup ${siteBase}${path === "/" ? "/" : path}`,
  `settled ${siteBase}${path === "/" ? "/" : path}`,
];

beforeEach(() => {
  lifecycle.length = 0;
});

afterEach(() => {
  failRenderingRoute(undefined);
});

test("every router the fragment entry renders is cleaned up once, by the entry", async () => {
  const html = await renderShellFragment();

  expect(lifecycle).toEqual(
    routes.flatMap((route) => cleanupThenSettle(route.path)),
  );
  for (const route of routes)
    expect(html).toContain(`<template data-shell-route="${route.path}"`);
});

test("a router whose route throws while rendering is cleaned up before the failure leaves the entry", async () => {
  failRenderingRoute("/research");

  await expect(renderShellFragment()).rejects.toThrow(
    "The /research page failed to render.",
  );

  expect(lifecycle).toEqual(
    routes
      .slice(0, routes.findIndex((route) => route.path === "/research") + 1)
      .flatMap((route) => cleanupThenSettle(route.path)),
  );
});
