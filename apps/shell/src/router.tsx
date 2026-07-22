// The shell owns route loaders, so this route-boundary import is the deliberate
// exception to the normal app-to-data-library dependency rule.
// eslint-disable-next-line @nx/enforce-module-boundaries
import type {
  Courses,
  Research,
  SoftwareProjects,
} from "@site/data-access-core";
// eslint-disable-next-line @nx/enforce-module-boundaries
import { validateCvDomain } from "@site/data-access-core";
import { SiteLayout } from "@site/layout";
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  type RouterHistory,
  redirect,
} from "@tanstack/react-router";
import type { ComponentType } from "react";
import { routes } from "./routes";

export type RouteView = "default" | "empty" | "error" | "loading";
type PageProps = {
  initialState?:
    | { name: "ready"; research: Research }
    | { name: "loading" | "error" };
  initialView?: RouteView | string | null;
  projects?: SoftwareProjects;
  courses?: Courses;
};

export interface RoutePages {
  home: ComponentType;
  bio: ComponentType<PageProps>;
  research: ComponentType<PageProps>;
  software: ComponentType<PageProps>;
  courses: ComponentType<PageProps>;
}

interface RouterContext {
  loadDomain(name: "research"): Promise<Research>;
  loadDomain(name: "software_projects"): Promise<SoftwareProjects>;
  loadDomain(name: "courses"): Promise<Courses>;
  search: URLSearchParams;
}

const routePath = (label: string) => {
  const route = routes.find((item) => item.label === label);
  if (!route) throw new Error(`Missing ${label} route in routes.json`);
  return route.path;
};

export function createSiteRouter({
  history,
  pages,
  context,
}: {
  history?: RouterHistory;
  pages: RoutePages;
  context: RouterContext;
}) {
  const Root = createRootRouteWithContext<RouterContext>()({
    component: () => (
      <SiteLayout routes={routes.map(({ path, label }) => ({ path, label }))}>
        <Outlet />
      </SiteLayout>
    ),
  });
  const home = createRoute({
    getParentRoute: () => Root,
    path: routePath("Home"),
    component: () => <pages.home />,
  });
  const bio = createRoute({
    getParentRoute: () => Root,
    path: routePath("Bio"),
    loader: ({ context: ctx }) => ({
      view: ctx.search.get("bio-view"),
    }),
    component: () => {
      const data = bio.useLoaderData();
      return <pages.bio initialView={data.view} />;
    },
  });
  const research = createRoute({
    getParentRoute: () => Root,
    path: routePath("Research"),
    loader: async ({ context: ctx }) => {
      const view = ctx.search.get("research-scenario");
      if (view === "loading" || view === "error")
        return { research: null, view };
      try {
        const loaded = await ctx.loadDomain("research");
        return {
          research: view === "empty" ? { ...loaded, projects: [] } : loaded,
          view,
        };
      } catch {
        return { research: null, view: "error" };
      }
    },
    component: () => {
      const data = research.useLoaderData();
      return (
        <pages.research
          initialState={
            data.view === "loading"
              ? { name: "loading" }
              : data.research
                ? { name: "ready", research: data.research }
                : { name: "error" }
          }
        />
      );
    },
  });
  const software = createRoute({
    getParentRoute: () => Root,
    path: routePath("Software"),
    loader: async ({ context: ctx }) => ({
      projects: await ctx.loadDomain("software_projects"),
      view: (ctx.search.get("software-view") ?? "default") as RouteView,
    }),
    component: () => {
      const data = software.useLoaderData();
      return (
        <pages.software initialView={data.view} projects={data.projects} />
      );
    },
  });
  const courses = createRoute({
    getParentRoute: () => Root,
    path: routePath("Courses"),
    loader: async ({ context: ctx }) => ({
      courses: await ctx.loadDomain("courses"),
      view: (ctx.search.get("courses-view") ?? "default") as RouteView,
    }),
    component: () => {
      const data = courses.useLoaderData();
      return <pages.courses initialView={data.view} courses={data.courses} />;
    },
  });
  const story = createRoute({
    getParentRoute: () => Root,
    path: "/story",
    beforeLoad: () => {
      throw redirect({ to: routePath("Bio") });
    },
  });
  const catchAll = createRoute({
    getParentRoute: () => Root,
    path: "$",
    beforeLoad: () => {
      throw redirect({ to: routePath("Home") });
    },
  });
  const routeTree = Root.addChildren([
    home,
    bio,
    research,
    software,
    courses,
    story,
    catchAll,
  ]);
  return createRouter({
    routeTree,
    ...(history ? { history } : {}),
    context,
    basepath: "/nick-derobertis-site",
    defaultPreload: "intent",
  });
}

export async function loadBrowserDomain<
  Name extends "research" | "software_projects" | "courses",
>(name: Name) {
  const response = await fetch(
    `/nick-derobertis-site/cv-data/domains/${name}.json`,
  );
  if (!response.ok)
    throw new Error(`${name} request failed: ${response.status}`);
  return validateCvDomain(name, await response.json());
}

export type SiteRouter = ReturnType<typeof createSiteRouter>;
