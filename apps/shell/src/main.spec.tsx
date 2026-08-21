// eslint-disable-next-line @nx/enforce-module-boundaries -- The shell owns site-base routing and its loader boundary; this spec serves the same base and the same validated CV domains the deployed shell does.
import { cvDataClient, siteBase } from "@site/data-access-core";
import { prerenderRouteAttribute } from "@site/route-state";
import {
  createRequestHandler,
  RouterServer,
} from "@tanstack/react-router/ssr/server";
import { act, fireEvent, screen } from "@testing-library/react";
import { prerender } from "react-dom/static";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import BioPage from "../test-remotes/bio-page";
import CoursesPage from "../test-remotes/courses-page";
import HomePage from "../test-remotes/home-page";
import ResearchPage from "../test-remotes/research-page";
import SoftwarePage from "../test-remotes/software-page";
import { createSiteRouter } from "./router";

// `vi.resetModules()` makes every test below re-import its subject, evaluating
// that whole module graph again: 1.4s idle here, 12.6s under the contention
// `nx affected --parallel=3` puts the gate under, past Vitest's 5000ms default.
// Far past that rather than just past it, so it still bounds a genuine hang.
const evaluatesAModuleGraph = { timeout: 120_000 };

const domains = {
  courses: cvDataClient.domain("courses"),
  research: cvDataClient.domain("research"),
  software_projects: cvDataClient.domain("software_projects"),
};

/**
 * The domain published under a requested URL's name, or nothing when the CV
 * publishes no such domain. The name arrives out of a fetched URL, so it is
 * matched against what is served rather than trusted to be one of them.
 */
function servedDomain(name: string | undefined) {
  return Object.entries(domains).find(([served]) => served === name)?.[1];
}

/**
 * The document the shell's prerender publishes for one route: the markup a
 * visitor is served, and the inline script that hands the router starting up
 * inside it the state that markup was rendered with. Producing both from the
 * shell's own router is what makes the hydration below the real one — a
 * hand-written payload would prove nothing about the bytes a visitor receives.
 */
async function publishedDocument(path: string) {
  let rendered: { html: string; hydration: string } | undefined;
  const handler = createRequestHandler({
    request: new Request(`https://shell.invalid${siteBase}${path}`),
    createRouter: () =>
      createSiteRouter({
        pages: {
          home: { component: HomePage },
          bio: { component: BioPage },
          research: { component: ResearchPage },
          software: { component: SoftwarePage },
          courses: { component: CoursesPage },
        },
        context: { loadDomain: async (name) => cvDataClient.domain(name) },
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
  if (!rendered) throw new Error(`The shell did not prerender ${path}`);
  return rendered;
}

/** Serves a prerendered document to the browser, scripts and all. */
async function serve(path: string) {
  const { html, hydration } = await publishedDocument(path);
  window.history.replaceState(null, "", `${siteBase}${path}`);
  document.body.innerHTML = `<div id="root" ${prerenderRouteAttribute}="${path}">${html}</div>`;
  const parsed = document.createElement("div");
  parsed.innerHTML = hydration;
  for (const script of parsed.querySelectorAll("script"))
    runInlineScript(script);
}

/**
 * Runs one of the served document's inline scripts. jsdom never executes a
 * script element, so the source is evaluated here against the same globals a
 * browser would give it, including the `document.currentScript` the router's
 * own payload script reads to take itself back out of the document.
 */
function runInlineScript(script: HTMLScriptElement) {
  document.head.append(script);
  Object.defineProperty(document, "currentScript", {
    configurable: true,
    value: script,
  });
  try {
    new Function(script.textContent ?? "")();
  } finally {
    Reflect.deleteProperty(document, "currentScript");
  }
}

function serveEmptyDocument(path: string) {
  window.history.replaceState(null, "", `${siteBase}${path}`);
  document.body.innerHTML = '<div id="root"></div>';
}

/** Stands in for the Pages host serving the CV domains the loaders fetch. */
function serveCvDomains() {
  vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
    const name = /domains\/([a-z_]+)\.json$/.exec(String(input))?.[1];
    const domain = servedDomain(name);
    return new Response(JSON.stringify(domain), {
      status: domain ? 200 : 404,
      headers: { "content-type": "application/json" },
    });
  });
}

async function startShell() {
  await act(async () => {
    await import("./main");
  });
}

beforeEach(() => {
  vi.resetModules();
  document.body.innerHTML = "";
  document.head.replaceChildren();
  Reflect.deleteProperty(window, "$_TSR");
  Reflect.deleteProperty(window, "$R");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test(
  "refuses to start against a document with no application root",
  evaluatesAModuleGraph,
  async () => {
    document.body.innerHTML = "<main></main>";

    await expect(import("./main")).rejects.toThrow("Missing application root");
  },
);

test(
  "adopts the prerendered route a visitor is already looking at",
  evaluatesAModuleGraph,
  async () => {
    await serve("/bio");
    const published = screen.getByRole("heading", { name: "Optimizing Life" });

    await startShell();

    // Hydration takes over the shipped nodes in place, so the page the visitor
    // has been reading since first paint is never torn down and repainted.
    expect(screen.getByRole("heading", { name: "Optimizing Life" })).toBe(
      published,
    );
    expect(
      screen.getByRole("navigation", { name: "Primary" }),
    ).toBeInTheDocument();
  },
);

test(
  "throws the prerendered document away when another view was asked for",
  evaluatesAModuleGraph,
  async () => {
    await serve("/bio");
    const published = screen.getByRole("heading", { name: "Optimizing Life" });
    window.history.replaceState(null, "", `${siteBase}/bio?bio-view=empty`);

    await startShell();

    // The document was published for the default view. Adopting it would leave
    // one view's markup underneath another view's render, so it has to go.
    expect(published).not.toBeInTheDocument();
    expect(await screen.findByText("view: empty")).toBeInTheDocument();
  },
);

test(
  "renders from scratch when the document ships no prerendered route",
  evaluatesAModuleGraph,
  async () => {
    serveEmptyDocument("/");

    await startShell();

    expect(
      await screen.findByRole("heading", { name: "Finance researcher" }),
    ).toBeInTheDocument();
  },
);

test(
  "loads a route's CV domain through the site's own data host",
  evaluatesAModuleGraph,
  async () => {
    serveEmptyDocument("/courses");
    serveCvDomains();

    await startShell();

    expect(
      await screen.findByText(`courses: ${domains.courses.length}`),
    ).toBeInTheDocument();
  },
);

test(
  "fetches each other route's remote only once the visitor goes there",
  evaluatesAModuleGraph,
  async () => {
    serveEmptyDocument("/");
    serveCvDomains();
    await startShell();
    await screen.findByRole("heading", { name: "Finance researcher" });

    const deferredRoutes: [link: string, heading: string][] = [
      ["Bio", "Optimizing Life"],
      ["Research", "Research"],
      ["Software", "Open-Source Software"],
      ["Courses", "Courses"],
    ];

    for (const [label, heading] of deferredRoutes) {
      fireEvent.click(screen.getByRole("link", { name: label }));

      expect(
        await screen.findByRole("heading", { name: heading }),
      ).toBeVisible();
    }
  },
);

test(
  "renders from scratch when the served payload carries no router state",
  evaluatesAModuleGraph,
  async () => {
    // A document whose hydration script never ran leaves the shell with markup it
    // cannot take over, so it renders the route rather than hydrating onto it.
    await serve("/bio");
    const published = screen.getByRole("heading", { name: "Optimizing Life" });
    Reflect.set(window, "$_TSR", {});

    await startShell();

    expect(published).not.toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "Optimizing Life" }),
    ).toBeInTheDocument();
  },
);

test(
  "renders from scratch when the served payload is not router state at all",
  evaluatesAModuleGraph,
  async () => {
    await serve("/bio");
    Reflect.set(window, "$_TSR", "not router state");

    await startShell();

    expect(
      await screen.findByRole("heading", { name: "Optimizing Life" }),
    ).toBeInTheDocument();
  },
);
