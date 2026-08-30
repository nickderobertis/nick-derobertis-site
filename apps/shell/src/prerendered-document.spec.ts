// eslint-disable-next-line @nx/enforce-module-boundaries -- The shell owns site-base routing; its spec reads the same base the deployed document is served under.
import { siteBase } from "@site/data-access-core/site";
import { prerenderRouteAttribute } from "@site/route-state";
import { createMemoryHistory } from "@tanstack/react-router";
import { beforeEach, expect, test } from "vitest";
import BioPage from "../test-remotes/bio-page";
import CoursesPage from "../test-remotes/courses-page";
import HomePage from "../test-remotes/home-page";
import ResearchPage from "../test-remotes/research-page";
import SoftwarePage from "../test-remotes/software-page";
import {
  entryRoutePath,
  rendersPrerenderedDocument,
} from "./prerendered-document";
import { createSiteRouter } from "./router";

function rootElement(stamped?: string) {
  const root = document.createElement("div");
  if (stamped !== undefined)
    root.setAttribute(prerenderRouteAttribute, stamped);
  return root;
}

function openAt(location: string) {
  return createSiteRouter({
    history: createMemoryHistory({
      initialEntries: [`${siteBase}${location}`],
    }),
    pages: {
      home: { component: HomePage },
      bio: { component: BioPage },
      research: { component: ResearchPage },
      software: { component: SoftwarePage },
      courses: { component: CoursesPage },
    },
    // Nothing here loads a route, so no CV domain is ever asked for; a loader
    // that refuses everything satisfies the context and would fail loudly if
    // one were.
    context: {
      loadDomain: async (name) => {
        throw new Error(`This spec serves no CV domain, including ${name}`);
      },
    },
  });
}

beforeEach(() => {
  window.history.replaceState(null, "", `${siteBase}/`);
});

test("takes the route the prerender stamped on the document it served", () => {
  window.history.replaceState(null, "", `${siteBase}/software`);

  expect(entryRoutePath(rootElement("/bio"))).toBe("/bio");
});

test("falls back to the location for a document the prerender never stamped", () => {
  // The static 404 document is served for any unknown path, so the pathname is
  // all there is to go on once the shell starts up inside it.
  window.history.replaceState(null, "", `${siteBase}/courses`);

  expect(entryRoutePath(rootElement())).toBe("/courses");
});

test("reads the bare site base as the home route", () => {
  window.history.replaceState(null, "", siteBase);

  expect(entryRoutePath(rootElement())).toBe("/");
});

test("reads a location outside the site base as it stands", () => {
  window.history.replaceState(null, "", "/bio");

  expect(entryRoutePath(rootElement())).toBe("/bio");
});

test("leaves every page deferred when no route owns the location", () => {
  window.history.replaceState(null, "", `${siteBase}/no-such-page`);

  // Nothing can be resolved before hydration here; the router's redirect is
  // what puts the visitor somewhere, and it needs no page in hand to do it.
  expect(entryRoutePath(rootElement())).toBeUndefined();
});

test("hydrates the prerendered home page a visitor arrived on", () => {
  expect(rendersPrerenderedDocument(openAt("/"))).toBe(true);
});

test("refuses to hydrate Home under any query at all", () => {
  // Home's panes are separate remotes reading their own state parameters
  // straight from the URL, so the shell cannot tell an inert parameter from a
  // pane override there.
  expect(rendersPrerenderedDocument(openAt("/?utm_source=newsletter"))).toBe(
    false,
  );
});

test("keeps a route's prerendered document through a tracking parameter", () => {
  expect(
    rendersPrerenderedDocument(openAt("/research?utm_source=newsletter")),
  ).toBe(true);
});

test("throws the prerendered document away for a genuine view override", () => {
  expect(rendersPrerenderedDocument(openAt("/bio?bio-view=empty"))).toBe(false);
});

test("keeps the document for a route that carries no view of its own", () => {
  // `/story` and unknown paths redirect rather than render, so they have no
  // loader deps to compare and nothing about them can invalidate the markup.
  expect(rendersPrerenderedDocument(openAt("/story"))).toBe(true);
  expect(rendersPrerenderedDocument(openAt("/no-such-page"))).toBe(true);
});
