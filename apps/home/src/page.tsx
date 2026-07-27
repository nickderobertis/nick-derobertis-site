import CardsSkeleton from "homeCards/Skeleton";
import CarouselSkeleton from "homeCarousel/Skeleton";
import ContactSkeleton from "homeContact/Skeleton";
import StorySkeleton from "homeStory/Skeleton";
import { siteBase } from "@site/data-access-core";
import { homeContent } from "@site/data-access-home";
import { prerenderRouteAttribute } from "@site/route-state";
import AwardsSkeleton from "awards/Skeleton";
import { type ComponentType, lazy, Suspense, useState } from "react";
import SkillsSkeleton from "skills/Skeleton";
import TimelineSkeleton from "timeline/Skeleton";
import "./home.css";

// Home eagerly resolves each pane's lightweight skeleton while its Page stays
// behind a dynamic import, preserving an app-shaped fallback per pane.
const Carousel = lazy(() => carouselModule);
const Cards = lazy(() => cardsModule);
const Story = lazy(() => storyModule);
const Contact = lazy(() => contactModule);
const Timeline = lazy(() => timelineModule);
const Skills = lazy(() => skillsModule);
const Awards = lazy(() => awardsModule);

// Importing Home primes its nested federation graph before the shell begins
// hydration. The page modules remain behind Suspense and the eager skeletons
// remain the visible fallback on client-side navigation.
const carouselModule = import("homeCarousel/Page");
const cardsModule = import("homeCards/Page");
const storyModule = import("homeStory/Page");
const contactModule = import("homeContact/Page");
const timelineModule = import("timeline/Page");
const skillsModule = import("skills/Page");
const awardsModule = import("awards/Page");
const hydrateFromSource =
  typeof document !== "undefined" &&
  document.getElementById("root")?.getAttribute(prerenderRouteAttribute) ===
    "/" &&
  !window.location.search;
type HydratedPanes = [
  ComponentType,
  ComponentType,
  ComponentType,
  ComponentType,
  ComponentType,
  ComponentType,
  ComponentType,
];
let hydratedPanes: HydratedPanes | undefined;

async function resolvePanes(): Promise<HydratedPanes> {
  const [carousel, cards, story, skills, awards, contact, timeline] =
    await Promise.all([
      carouselModule,
      cardsModule,
      storyModule,
      skillsModule,
      awardsModule,
      contactModule,
      timelineModule,
    ]);
  return [
    carousel.default,
    cards.default,
    story.default,
    skills.default,
    awards.default,
    contact.default,
    timeline.default,
  ];
}

if (hydrateFromSource) hydratedPanes = await resolvePanes();

let panePreload: Promise<void> | undefined;

// The shell's Home route loader calls this on hover intent, generalizing the
// entry-at-"/" pane cache to client-side navigation: once it settles, Home
// mounts the resolved panes directly instead of suspending on lazy() — which
// flashes a skeleton on first mount even when its promise already resolved.
// Server rendering composes the panes directly, so there is nothing to warm.
export function preload(): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  panePreload ??= resolvePanes().then((panes) => {
    hydratedPanes = panes;
  });
  return panePreload;
}

// Keep the Home host in both shared data dependency graphs; panes own rendering.
void siteBase;
void homeContent;

export default function HomePage() {
  // Settle the render path once per mount: a preload that lands mid-life must
  // not swap pane component identity and remount every pane underneath.
  const [panes] = useState(() => hydratedPanes);
  if (panes) {
    const [
      HydratedCarousel,
      HydratedCards,
      HydratedStory,
      HydratedSkills,
      HydratedAwards,
      HydratedContact,
      HydratedTimeline,
    ] = panes;
    return (
      <div className="home-main">
        <HydratedCarousel />
        <HydratedCards />
        <HydratedStory />
        <HydratedSkills />
        <HydratedAwards />
        <HydratedContact />
        <HydratedTimeline />
      </div>
    );
  }
  return (
    <div className="home-main">
      <Suspense fallback={<CarouselSkeleton />}>
        <Carousel />
      </Suspense>
      <Suspense fallback={<CardsSkeleton />}>
        <Cards />
      </Suspense>
      <Suspense fallback={<StorySkeleton />}>
        <Story />
      </Suspense>
      <Suspense fallback={<SkillsSkeleton />}>
        <Skills />
      </Suspense>
      <Suspense fallback={<AwardsSkeleton />}>
        <Awards />
      </Suspense>
      <Suspense fallback={<ContactSkeleton />}>
        <Contact />
      </Suspense>
      <Suspense fallback={<TimelineSkeleton />}>
        <Timeline />
      </Suspense>
    </div>
  );
}
