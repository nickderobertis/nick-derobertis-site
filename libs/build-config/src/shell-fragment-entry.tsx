// An rspack entry point, not a module this library imports: the publish plugin
// compiles it in its own build to prerender the shell's published fragment, and
// aliases `@site-fragment/*` to the shell's own router and routes there, the
// same way a remote's entry is aliased to that remote's page. The CV data it
// renders with is read through the client every app reads it through; the
// library's own module graph reaches neither the shell nor the CV data.
/* eslint-disable @nx/enforce-module-boundaries -- This build-only rspack entry is compiled in the shell's graph with @site-fragment aliases; it is not imported by the library runtime. */

import { cvDataClient } from "@site/data-access-core";
import { createSiteRouter } from "@site-fragment/router";
import { routes } from "@site-fragment/routes";
import {
  createRequestHandler,
  RouterServer,
} from "@tanstack/react-router/ssr/server";
import { prerender } from "react-dom/static";

function slot(name: string) {
  return function PublishedFragmentSlot() {
    return <template data-published-fragment={name} />;
  };
}

export async function renderShellFragment() {
  const pages = {
    home: { component: slot("home") },
    bio: { component: slot("bio") },
    research: { component: slot("research") },
    software: { component: slot("software") },
    courses: { component: slot("courses") },
  };
  const domains = {
    research: cvDataClient.domain("research"),
    software_projects: cvDataClient.domain("software_projects"),
    courses: cvDataClient.domain("courses"),
  };
  const renderedRoutes: string[] = [];
  for (const route of routes) {
    let rendered: { html: string; hydration: string } | undefined;
    const handler = createRequestHandler({
      request: new Request(
        `https://fragment.invalid/nick-derobertis-site${route.path}`,
      ),
      createRouter: () =>
        createSiteRouter({
          pages,
          // The generic parameter carries the requested domain's name through to
          // its own value type, so each route loader receives exactly the domain
          // it asked for without the lookup widening to a union.
          context: {
            loadDomain: async <Name extends keyof typeof domains>(
              name: Name,
            ): Promise<(typeof domains)[Name]> => domains[name],
          },
        }),
    });
    // `router.serverSsr` is router-core's framework-only SSR lifecycle. It is
    // driven by hand because the public `renderRouterToString` renders with
    // `renderToString`, which never resolves Suspense; `prerender` does, so the
    // lifecycle around it is this entry's to run. That means running all of it,
    // including the `cleanup()` the public helper runs in a `finally`: five
    // routers are rendered in this one process, and a router left uncleaned
    // keeps its SSR buffers and listeners for the rest of it.
    //
    // That surface is framework-only, so package.json depends on
    // `@tanstack/router-core` directly at the exact version the lockfile
    // resolves rather than inheriting it through `@tanstack/react-router`. A
    // direct dependency is chosen over a `pnpm.overrides` entry because
    // AGENTS.md holds every dependency's `pnpm outdated` `current` to its
    // `wanted`, and only a declared dependency is reported there at all. What
    // keeps that declaration from becoming a second, drifting statement of the
    // resolved version is router-core-pin.spec.ts, which holds it to the copy
    // `@tanstack/react-router` itself loads.
    await handler(async ({ router }) => {
      try {
        while (!router.serverSsr?.isSerializationFinished())
          await new Promise<void>((resolve) => setImmediate(resolve));
        const { prelude } = await prerender(<RouterServer router={router} />);
        router.serverSsr?.setRenderFinished();
        rendered = {
          html: await new Response(prelude).text(),
          hydration: router.serverSsr?.takeBufferedHtml() ?? "",
        };
        return new Response(rendered.html);
      } finally {
        // llmlint: ignore[changed_behavior_has_e2e] This build-time step has no browser interface of its own to drive: it runs in the publish build, releases router state after the markup is already taken, and adds nothing to that markup and removes nothing from it. Both render paths stay covered where they are observable — apps/shell/e2e/site.spec.ts drives the composed published bytes with JavaScript disabled and then through hydration, and every journey spec drives the same artifact host-composed — so those journeys are what proves this leaves the render unchanged. shell-fragment-entry.spec.tsx drives this real entry and records this call against every router it renders, including one whose route throws.
        router.serverSsr?.cleanup();
      }
    });
    if (!rendered)
      throw new Error(
        `TanStack Router did not render ${route.path}. Fix the shell route and loader contract, then rebuild the shell fragment.`,
      );
    renderedRoutes.push(
      `<template data-shell-route="${route.path}" data-route-heading="${Buffer.from(route.heading).toString("base64")}" data-route-description="${Buffer.from(route.description).toString("base64")}" data-router-hydration="${Buffer.from(rendered.hydration).toString("base64")}">${rendered.html}</template>`,
    );
  }
  return renderedRoutes.join("");
}
