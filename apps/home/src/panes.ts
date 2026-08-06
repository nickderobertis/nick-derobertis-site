import CardsSkeleton from "homeCards/Skeleton";
import CarouselSkeleton from "homeCarousel/Skeleton";
import ContactSkeleton from "homeContact/Skeleton";
import StorySkeleton from "homeStory/Skeleton";
import { prerenderRouteAttribute } from "@site/route-state";
import AwardsSkeleton from "awards/Skeleton";
import { type ComponentType, lazy } from "react";
import SkillsSkeleton from "skills/Skeleton";
import TimelineSkeleton from "timeline/Skeleton";

// Importing Home primes its nested federation graph before the shell begins
// hydration. The page modules remain behind Suspense and the eager skeletons
// remain the visible fallback on client-side navigation.
//
// Awards is named on its own because it is the one pane whose data is fetched
// rather than bundled, so warming it needs its module and not just its render.
const awardsModule = import("awards/Page");
const paneModules = [
  {
    name: "home-carousel",
    Skeleton: CarouselSkeleton,
    module: import("homeCarousel/Page"),
  },
  {
    name: "home-cards",
    Skeleton: CardsSkeleton,
    module: import("homeCards/Page"),
  },
  {
    name: "home-story",
    Skeleton: StorySkeleton,
    module: import("homeStory/Page"),
  },
  { name: "skills", Skeleton: SkillsSkeleton, module: import("skills/Page") },
  { name: "awards", Skeleton: AwardsSkeleton, module: awardsModule },
  {
    name: "home-contact",
    Skeleton: ContactSkeleton,
    module: import("homeContact/Page"),
  },
  {
    name: "timeline",
    Skeleton: TimelineSkeleton,
    module: import("timeline/Page"),
  },
];

/** One pane of the composed page, named by the remote that publishes it. */
export interface ResolvedPane {
  name: string;
  Page: ComponentType;
}

/** One pane Home has yet to resolve, with the fallback it suspends on. */
export interface SuspendedPane extends ResolvedPane {
  /**
   * Home eagerly resolves each pane's lightweight skeleton while its Page stays
   * behind a dynamic import, preserving an app-shaped fallback per pane.
   */
  Skeleton: ComponentType;
}

export const homePanes: readonly SuspendedPane[] = paneModules.map(
  ({ name, Skeleton, module }) => ({
    name,
    Skeleton,
    Page: lazy(() => module),
  }),
);

const hydrateFromSource =
  typeof document !== "undefined" &&
  document.getElementById("root")?.getAttribute(prerenderRouteAttribute) ===
    "/" &&
  !window.location.search;
let resolved: readonly ResolvedPane[] | undefined;

async function resolvePanes(): Promise<readonly ResolvedPane[]> {
  return await Promise.all(
    paneModules.map(async ({ name, module }) => ({
      name,
      Page: (await module).default,
    })),
  );
}

if (hydrateFromSource) resolved = await resolvePanes();

/**
 * The panes a warmed Home can mount directly, or `undefined` while it still has
 * to suspend on them. The page reads this once per mount: a preload that lands
 * mid-life must not swap pane component identity and remount every pane
 * underneath.
 */
export function resolvedPanes(): readonly ResolvedPane[] | undefined {
  return resolved;
}

// Panes own their data. Carousel, cards, story and contact read bundled
// homeContent, and timeline and skills read bundled CV domains, so all six
// render their content on the first frame. Awards is the one pane that fetches,
// so warming it is what lets a preloaded Home mount with no skeleton anywhere.
// The entry-at-"/" path deliberately does not warm: its prerendered markup
// contains the awards skeleton, and seeding past it would break hydration.
async function warmPaneData(): Promise<void> {
  const awards = await awardsModule;
  await awards.preload();
}

let panePreload: Promise<void> | undefined;

// The shell's Home route loader calls this on hover intent, generalizing the
// entry-at-"/" pane cache to client-side navigation: once it settles, Home
// mounts the resolved panes directly instead of suspending on lazy() — which
// flashes a skeleton on first mount even when its promise already resolved.
// Server rendering composes the panes directly, so there is nothing to warm.
// llmlint: ignore[changed_behavior_has_e2e] Hover intent is a shell-router behaviour, so this entry point has no standalone equivalent to cover: apps/home/src/main.tsx mounts the page with no router and no nav links to hover. preload.spec.ts drives it through the real shell, and home.spec.ts keeps covering the standalone remote's render path, which still takes the Suspense branch in page.tsx.
export function preload(): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  panePreload ??= (async () => {
    const [panes] = await Promise.all([resolvePanes(), warmPaneData()]);
    resolved = panes;
  })();
  return panePreload;
}
