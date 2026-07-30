// The shell owns route loaders, so this route-boundary import is the deliberate
// exception to the normal app-to-data-library dependency rule.
// eslint-disable-next-line @nx/enforce-module-boundaries
import type {
  Courses,
  Research,
  SoftwareProjects,
} from "@site/data-access-core";
// eslint-disable-next-line @nx/enforce-module-boundaries
import { siteBase, validateCvDomain } from "@site/data-access-core";
import { SiteLayout } from "@site/layout";
import {
  type BioPageProps,
  type CoursesPageProps,
  prerenderRouteAttribute,
  type ResearchPageProps,
  type RouteView,
  routeViewQueryKeys,
  routeViews,
  type SoftwarePageProps,
} from "@site/route-state";
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Outlet,
  type RouteComponent,
  type RouterHistory,
  redirect,
} from "@tanstack/react-router";
import type { ComponentType, ReactElement } from "react";
import { routes } from "./routes";

/**
 * A route's page. `component` is a page the caller already resolved — every
 * route during server rendering, and the entry route in the browser, which has
 * to be in hand before hydration. `load` defers the page to the router, which
 * fetches it when the route is preloaded or navigated to.
 */
export type RoutePage<Props> =
  | { component: ComponentType<Props> }
  | { load: () => Promise<{ default: ComponentType<Props> }> };

export interface RoutePages {
  home: RoutePage<Record<string, unknown>>;
  /**
   * Resolves Home's pane modules so a hovered Home link mounts them without a
   * skeleton. Server rendering composes the panes directly and omits it.
   */
  homePreload?: () => Promise<void>;
  bio: RoutePage<BioPageProps>;
  research: RoutePage<ResearchPageProps<Research>>;
  software: RoutePage<SoftwarePageProps<SoftwareProjects>>;
  courses: RoutePage<CoursesPageProps<Courses>>;
}

/**
 * Adapts a page to the route component that renders it from loader data. A
 * deferred page becomes a lazyRouteComponent, so the router owns fetching it:
 * `defaultPreload: "intent"` calls its `preload()` alongside the route's loader
 * on hover, and a match only settles once that chunk has arrived.
 */
function routeComponent<Props>(
  page: RoutePage<Props>,
  render: (Page: ComponentType<Props>) => ReactElement,
): RouteComponent {
  if ("component" in page) {
    const Page = page.component;
    return () => render(Page);
  }
  const { load } = page;
  return lazyRouteComponent(async () => {
    const { default: Page } = await load();
    return { default: () => render(Page) };
  });
}

interface RouterContext {
  loadDomain(name: "research"): Promise<Research>;
  loadDomain(name: "software_projects"): Promise<SoftwareProjects>;
  loadDomain(name: "courses"): Promise<Courses>;
}

/**
 * Reads a route's view-override parameter out of a raw query string. Returning
 * undefined for everything else is what keeps the rest of a query string —
 * `utm_source`, `fbclid`, `ref` — out of the route's rendered output, and out
 * of the links the router builds from this location.
 */
function viewOverride(
  search: Record<string, unknown>,
  key: string,
): RouteView | undefined {
  return routeViews.find((view) => view === search[key]);
}

// Warmed logos are kept alive here so the browser cannot collect an in-flight
// request, and so a repeated loader run never refetches an already warm URL.
const warmedSoftwareLogos = new Map<string, HTMLImageElement>();

// Software cards render `logo_base64` in preference to `logo_url`, so only the
// external URLs cost a request. Warming them alongside the domain JSON means a
// hovered Software link arrives with its visible card logos already decoded.
function warmSoftwareLogos(projects: SoftwareProjects) {
  if (typeof Image === "undefined") return;
  for (const project of projects) {
    const url = project.logo_base64 ? undefined : project.logo_url;
    if (!url || warmedSoftwareLogos.has(url)) continue;
    const image = new Image();
    warmedSoftwareLogos.set(url, image);
    image.src = url;
  }
}

export const routePath = (label: string) => {
  const route = routes.find((item) => item.label === label);
  if (!route)
    throw new Error(
      `Missing ${label} route in routes.json. Add the route to apps/shell/src/routes.json and rerun just check.`,
    );
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
    // Start the pane preload without awaiting it: hover intent gets a warm
    // Home, while a click that lands first still mounts the pane skeletons
    // immediately instead of stalling on the previous route.
    loader: () => {
      void pages.homePreload?.();
    },
    component: routeComponent(pages.home, (Page) => <Page />),
  });
  const bio = createRoute({
    getParentRoute: () => Root,
    path: routePath("Bio"),
    validateSearch: (search: Record<string, unknown>) => ({
      [routeViewQueryKeys.bio]: viewOverride(search, routeViewQueryKeys.bio),
    }),
    loaderDeps: ({ search }) => ({
      view: search[routeViewQueryKeys.bio] ?? "default",
    }),
    loader: ({ deps }) => deps,
    component: routeComponent(pages.bio, (Page) => {
      const data = bio.useLoaderData();
      return <Page initialView={data.view} />;
    }),
  });
  const research = createRoute({
    getParentRoute: () => Root,
    path: routePath("Research"),
    validateSearch: (search: Record<string, unknown>) => ({
      [routeViewQueryKeys.research]: viewOverride(
        search,
        routeViewQueryKeys.research,
      ),
    }),
    loaderDeps: ({ search }) => ({
      view: search[routeViewQueryKeys.research] ?? "default",
    }),
    loader: async ({ context: ctx, deps: { view } }) => {
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
    component: routeComponent(pages.research, (Page) => {
      const data = research.useLoaderData();
      return (
        <Page
          initialState={
            data.view === "loading"
              ? { name: "loading" }
              : data.research
                ? { name: "ready", value: data.research }
                : { name: "error" }
          }
        />
      );
    }),
  });
  const software = createRoute({
    getParentRoute: () => Root,
    path: routePath("Software"),
    validateSearch: (search: Record<string, unknown>) => ({
      [routeViewQueryKeys.software]: viewOverride(
        search,
        routeViewQueryKeys.software,
      ),
    }),
    loaderDeps: ({ search }) => ({
      view: search[routeViewQueryKeys.software] ?? "default",
    }),
    loader: async ({ context: ctx, deps: { view } }) => {
      if (view === "loading" || view === "error")
        return { projects: null, view };
      try {
        const projects = await ctx.loadDomain("software_projects");
        warmSoftwareLogos(projects);
        return { projects, view };
      } catch {
        // `as const` keeps this branch's view a literal; without it the union
        // with the branches above widens to string and the page loses the
        // narrowing it renders from.
        return { projects: null, view: "error" as const };
      }
    },
    component: routeComponent(pages.software, (Page) => {
      const data = software.useLoaderData();
      return (
        <Page initialView={data.view} projects={data.projects ?? undefined} />
      );
    }),
  });
  const courses = createRoute({
    getParentRoute: () => Root,
    path: routePath("Courses"),
    validateSearch: (search: Record<string, unknown>) => ({
      [routeViewQueryKeys.courses]: viewOverride(
        search,
        routeViewQueryKeys.courses,
      ),
    }),
    loaderDeps: ({ search }) => ({
      view: search[routeViewQueryKeys.courses] ?? "default",
    }),
    loader: async ({ context: ctx, deps: { view } }) => {
      if (view === "loading" || view === "error")
        return { courses: null, view };
      try {
        return {
          courses: await ctx.loadDomain("courses"),
          view,
        };
      } catch {
        return { courses: null, view: "error" as const };
      }
    },
    component: routeComponent(pages.courses, (Page) => {
      const data = courses.useLoaderData();
      return (
        <Page initialView={data.view} courses={data.courses ?? undefined} />
      );
    }),
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
    basepath: siteBase,
    defaultPreload: "intent",
  });
}

/**
 * Reports the route the document in the browser was rendered for, so its page
 * can be resolved before hydration while every other route stays deferred. The
 * prerender step stamps the route on the root element; the pathname is the
 * fallback for a document it never stamped, such as the static 404 the server
 * returns for an unknown path. Returns undefined when no route owns the
 * location, leaving every page deferred for the router's redirect to resolve.
 */
export function entryRoutePath(root: Element): string | undefined {
  const stamped = root.getAttribute(prerenderRouteAttribute);
  const pathname = window.location.pathname.startsWith(siteBase)
    ? window.location.pathname.slice(siteBase.length)
    : window.location.pathname;
  const candidate = stamped ?? (pathname === "" ? "/" : pathname);
  return routes.find((route) => route.path === candidate)?.path;
}

/**
 * Reports whether the browser's location still renders the document the
 * prerender step produced, so the shell can hydrate it instead of discarding
 * it. Every route is prerendered with an empty query string, and the route
 * `validateSearch` above is what turns a query string into rendered output: a
 * view override genuinely changes the markup, while a tracking parameter
 * leaves it identical and must not cost the visitor their prerendered HTML.
 *
 * Home is the conservative exception. Its panes are separate remotes that each
 * read their own state parameter straight from the URL rather than through
 * this router, so the shell cannot tell an inert parameter from a pane
 * override there.
 */
export function rendersPrerenderedDocument(router: SiteRouter): boolean {
  const { pathname, search } = router.state.location;
  const matches = router.matchRoutes(pathname, search);
  const leaf = matches[matches.length - 1];
  if (leaf?.fullPath === routePath("Home"))
    return Object.keys(search).length === 0;
  const deps: unknown = leaf?.loaderDeps;
  return (
    !deps ||
    typeof deps !== "object" ||
    !("view" in deps) ||
    deps.view === "default"
  );
}

export async function loadBrowserDomain<
  Name extends "research" | "software_projects" | "courses",
>(name: Name) {
  const response = await fetch(`${siteBase}/cv-data/domains/${name}.json`);
  if (!response.ok)
    throw new Error(`${name} request failed: ${response.status}`);
  return validateCvDomain(name, await response.json());
}

export type SiteRouter = ReturnType<typeof createSiteRouter>;
