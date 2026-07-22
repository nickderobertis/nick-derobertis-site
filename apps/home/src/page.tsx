import CardsSkeleton from "homeCards/Skeleton";
import CarouselSkeleton from "homeCarousel/Skeleton";
import ContactSkeleton from "homeContact/Skeleton";
import StorySkeleton from "homeStory/Skeleton";
import { siteBase } from "@site/data-access-core";
import { homeContent } from "@site/data-access-home";
import AwardsSkeleton from "awards/Skeleton";
import { lazy, Suspense } from "react";
import SkillsSkeleton from "skills/Skeleton";
import TimelineSkeleton from "timeline/Skeleton";

// Home eagerly resolves each pane's lightweight skeleton while its Page stays
// behind a dynamic import, preserving an app-shaped fallback per pane.
const Carousel = lazy(() => import("homeCarousel/Page"));
const Cards = lazy(() => import("homeCards/Page"));
const Story = lazy(() => import("homeStory/Page"));
const Contact = lazy(() => import("homeContact/Page"));
const Timeline = lazy(() => import("timeline/Page"));
const Skills = lazy(() => import("skills/Page"));
const Awards = lazy(() => import("awards/Page"));

// Keep the Home host in both shared data dependency graphs; panes own rendering.
void siteBase;
void homeContent;

export default function HomePage() {
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
