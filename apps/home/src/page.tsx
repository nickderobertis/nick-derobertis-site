import { siteBase } from "@site/data-access-core";
import { homeContent } from "@site/data-access-home";
import { lazy, Suspense } from "react";

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
      <Suspense
        fallback={<output className="pane-state">Loading HOME page…</output>}
      >
        <Carousel />
        <Cards />
        <Story />
        <Skills />
        <Awards />
        <Contact />
        <Timeline />
      </Suspense>
    </div>
  );
}
