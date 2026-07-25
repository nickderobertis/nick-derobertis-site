import CardsSkeleton from "homeCards/Skeleton";
import CarouselSkeleton from "homeCarousel/Skeleton";
import ContactSkeleton from "homeContact/Skeleton";
import StorySkeleton from "homeStory/Skeleton";
import { siteBase } from "@site/data-access-core";
import { homeContent } from "@site/data-access-home";
import AwardsSkeleton from "awards/Skeleton";
import { type ComponentType, lazy, Suspense } from "react";
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
  document.getElementById("root")?.getAttribute("data-prerendered-route") ===
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
if (hydrateFromSource) {
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
  hydratedPanes = [
    carousel.default,
    cards.default,
    story.default,
    skills.default,
    awards.default,
    contact.default,
    timeline.default,
  ];
}

// Keep the Home host in both shared data dependency graphs; panes own rendering.
void siteBase;
void homeContent;

export default function HomePage() {
  if (hydratedPanes) {
    const [
      HydratedCarousel,
      HydratedCards,
      HydratedStory,
      HydratedSkills,
      HydratedAwards,
      HydratedContact,
      HydratedTimeline,
    ] = hydratedPanes;
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
