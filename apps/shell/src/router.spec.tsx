// eslint-disable-next-line @nx/enforce-module-boundaries -- The shell owns this route-loader boundary; its spec serves the same validated CV domains the deployed loaders fetch.
import { cvDataClient } from "@site/data-access-core/bundled";
// eslint-disable-next-line @nx/enforce-module-boundaries -- The shell owns site-base routing; its spec drives the same base the deployed router uses.
import { siteBase } from "@site/data-access-core/site";
import { createMemoryHistory } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import BioPage from "../test-remotes/bio-page";
import CoursesPage from "../test-remotes/courses-page";
import HomePage, { preload, preloadCount } from "../test-remotes/home-page";
import ResearchPage from "../test-remotes/research-page";
import SoftwarePage from "../test-remotes/software-page";
import { App } from "./app";
import {
  createSiteRouter,
  type LoadRouteDomain,
  type RoutePages,
} from "./router";

const research = cvDataClient.domain("research");
const courses = cvDataClient.domain("courses");
const softwareProjects = cvDataClient.domain("software_projects");

/** Serves each route's domain from the CV, as the deployed loaders do. */
const serveCvDomains: LoadRouteDomain = async (name) =>
  cvDataClient.domain(name);

/**
 * The five route remotes, resolved the two ways the shell resolves them: the
 * entry route arrives already loaded, and the rest are deferred behind the
 * router's own fetch. Bio is the deferred one here so both paths are driven.
 */
const pages: RoutePages = {
  home: { component: HomePage },
  homePreload: preload,
  bio: { load: async () => ({ default: BioPage }) },
  research: { component: ResearchPage },
  software: { component: SoftwarePage },
  courses: { component: CoursesPage },
};

function openSite(path: string, loadDomain: LoadRouteDomain = serveCvDomains) {
  const router = createSiteRouter({
    history: createMemoryHistory({ initialEntries: [`${siteBase}${path}`] }),
    pages,
    context: { loadDomain },
  });
  render(<App router={router} />);
  return router;
}

function navigateTo(label: string) {
  fireEvent.click(screen.getByRole("link", { name: label }));
}

beforeEach(() => {
  vi.restoreAllMocks();
});

test("opens on the route the visitor asked for, inside the site chrome", async () => {
  openSite("/");

  expect(
    await screen.findByRole("heading", { name: "Finance researcher" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("navigation", { name: "Primary" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("carries a visitor between routes without leaving the shell", async () => {
  const router = openSite("/");
  await screen.findByRole("heading", { name: "Finance researcher" });
  const nav = screen.getByRole("navigation", { name: "Primary" });

  navigateTo("Research");

  expect(
    await screen.findByRole("heading", { name: "Research" }),
  ).toBeInTheDocument();
  expect(
    screen.getByText(`projects: ${research.projects?.length ?? 0}`),
  ).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/research");
  // The chrome is mounted by the root route, so a route change swaps only the
  // outlet and the navigation the visitor is using never unmounts under them.
  expect(screen.getByRole("navigation", { name: "Primary" })).toBe(nav);
  expect(screen.getByRole("link", { name: "Research" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("fetches a deferred route's page only once the visitor goes there", async () => {
  const loaded: string[] = [];
  const router = createSiteRouter({
    history: createMemoryHistory({ initialEntries: [`${siteBase}/`] }),
    pages: {
      ...pages,
      bio: {
        load: async () => {
          loaded.push("bio");
          return { default: BioPage };
        },
      },
    },
    context: { loadDomain: serveCvDomains },
  });
  render(<App router={router} />);
  await screen.findByRole("heading", { name: "Finance researcher" });

  expect(loaded).toEqual([]);

  navigateTo("Bio");

  expect(
    await screen.findByRole("heading", { name: "Optimizing Life" }),
  ).toBeInTheDocument();
  expect(loaded).toEqual(["bio"]);
});

test("warms Home's panes when its route loads", async () => {
  const before = preloadCount();

  openSite("/");
  await screen.findByRole("heading", { name: "Finance researcher" });

  expect(preloadCount()).toBe(before + 1);
});

test("sends a visitor who kept an old /story link to the bio", async () => {
  const router = openSite("/story");

  expect(
    await screen.findByRole("heading", { name: "Optimizing Life" }),
  ).toBeInTheDocument();
  await waitFor(() => expect(router.state.location.pathname).toBe("/bio"));
});

test("recovers a visitor on an unknown path onto the home page", async () => {
  const router = openSite("/no-such-page");

  expect(
    await screen.findByRole("heading", { name: "Finance researcher" }),
  ).toBeInTheDocument();
  await waitFor(() => expect(router.state.location.pathname).toBe("/"));
});

test("hands a route the view a visitor asked for in the query", async () => {
  openSite("/bio?bio-view=empty");

  expect(await screen.findByText("view: empty")).toBeInTheDocument();
});

test("ignores a tracking parameter rather than treating it as a view", async () => {
  openSite("/bio?utm_source=newsletter&bio-view=nonsense");

  expect(await screen.findByText("view: default")).toBeInTheDocument();
  // Neither the page nor the links the shell builds from this location carry
  // the parameter, so it cannot follow the visitor around the site.
  expect(screen.getByRole("link", { name: "Research" })).toHaveAttribute(
    "href",
    `${siteBase}/research`,
  );
});

test("gives Research an empty collection when a visitor asks to see one", async () => {
  openSite("/research?research-scenario=empty");

  expect(await screen.findByText("state: ready")).toBeInTheDocument();
  expect(screen.getByText("projects: 0")).toBeInTheDocument();
});

test("holds Research on its loading frame without touching the CV", async () => {
  const loadDomain = vi.fn();

  openSite("/research?research-scenario=loading", loadDomain);

  expect(await screen.findByText("state: loading")).toBeInTheDocument();
  expect(loadDomain).not.toHaveBeenCalled();
});

test("reports Research as failed when the CV domain cannot be loaded", async () => {
  openSite("/research", async () => {
    throw new Error("research unavailable");
  });

  expect(await screen.findByText("state: error")).toBeInTheDocument();
});

test("reports the steered Research failure without asking the CV for it", async () => {
  const loadDomain = vi.fn();

  openSite("/research?research-scenario=error", loadDomain);

  expect(await screen.findByText("state: error")).toBeInTheDocument();
  expect(loadDomain).not.toHaveBeenCalled();
});

test("hands Software the projects the CV publishes", async () => {
  openSite("/software");

  expect(
    await screen.findByText(`projects: ${softwareProjects.length}`),
  ).toBeInTheDocument();
  expect(screen.getByText("view: default")).toBeInTheDocument();
});

test("leaves Software with no projects when the CV domain fails", async () => {
  openSite("/software", async () => {
    throw new Error("software unavailable");
  });

  expect(await screen.findByText("projects: none")).toBeInTheDocument();
  expect(screen.getByText("view: error")).toBeInTheDocument();
});

test("holds Software on the view a visitor steered it into", async () => {
  const loadDomain = vi.fn();

  openSite("/software?software-view=loading", loadDomain);

  expect(await screen.findByText("view: loading")).toBeInTheDocument();
  expect(loadDomain).not.toHaveBeenCalled();
});

test("hands Courses the courses the CV publishes", async () => {
  openSite("/courses");

  expect(
    await screen.findByText(`courses: ${courses.length}`),
  ).toBeInTheDocument();
});

test("leaves Courses with none when the CV domain fails", async () => {
  openSite("/courses", async () => {
    throw new Error("courses unavailable");
  });

  expect(await screen.findByText("courses: none")).toBeInTheDocument();
  expect(screen.getByText("view: error")).toBeInTheDocument();
});

test("holds Courses on the view a visitor steered it into", async () => {
  const loadDomain = vi.fn();

  openSite("/courses?courses-view=error", loadDomain);

  expect(await screen.findByText("view: error")).toBeInTheDocument();
  expect(loadDomain).not.toHaveBeenCalled();
});
