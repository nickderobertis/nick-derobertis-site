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
    await handler(async ({ router }) => {
      while (!router.serverSsr?.isSerializationFinished())
        await new Promise<void>((resolve) => setImmediate(resolve));
      const { prelude } = await prerender(<RouterServer router={router} />);
      router.serverSsr?.setRenderFinished();
      rendered = {
        html: await new Response(prelude).text(),
        hydration: router.serverSsr?.takeBufferedHtml() ?? "",
      };
      return new Response(rendered.html);
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
