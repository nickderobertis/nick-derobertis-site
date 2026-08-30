// The shell owns route loaders, so this route-boundary import is the deliberate
// exception to the normal app-to-data-library dependency rule.
// eslint-disable-next-line @nx/enforce-module-boundaries -- The shell validates route payloads at its loader boundary; feature apps never gain this data-core dependency.
import type {
  Courses,
  CvDomains,
  Research,
  SoftwareProjects,
} from "@site/data-access-core";
// eslint-disable-next-line @nx/enforce-module-boundaries -- The shell owns site-base routing and validates route payloads before passing them to remotes.
import { siteBase } from "@site/data-access-core/site";
import {
  type BioPageProps,
  type CoursesPageProps,
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
  type RouterHistory,
  redirect,
} from "@tanstack/react-router";
import { type RoutePage, routeComponent } from "./route-component";
import { routePath } from "./route-path";
import { SiteRoot } from "./site-root";
import { warmSoftwareLogos } from "./warm-software-logos";

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

/** The CV domains a route loader fetches, named as the CV publishes them. */
export type RouteDomainName = "courses" | "research" | "software_projects";

/**
 * Fetches one CV domain for a route loader. The requested name is the type
 * parameter, so each loader below receives that domain's own payload type
 * rather than something it has to narrow by hand.
 */
export type LoadRouteDomain = <Name extends RouteDomainName>(
  name: Name,
) => Promise<CvDomains[Name]>;

interface RouterContext {
  loadDomain: LoadRouteDomain;
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
    component: SiteRoot,
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
        // Same as the software loader above: the literal keeps this branch's
        // view from widening to string and losing the page's narrowing.
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
  // `story` and `catchAll` redirect during routing rather than render, so
  // neither is prerendered and neither owns a directory in the deployed
  // artifact. A direct request for /story/ therefore returns 404 from Pages by
  // design, and the redirect applies only once the shell is already running.
  // The five prerendered routes are home, bio, research, software, and courses.
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

export type SiteRouter = ReturnType<typeof createSiteRouter>;
