import { lazy, Suspense } from "react";

const Carousel = lazy(() => import("homeCarousel/Page"));
const Cards = lazy(() => import("homeCards/Page"));
const Story = lazy(() => import("homeStory/Page"));
const Contact = lazy(() => import("homeContact/Page"));

export default function HomePage() {
  return (
    <div className="home-main">
      <Suspense
        fallback={<output className="pane-state">Loading HOME page…</output>}
      >
        <Carousel />
        <Cards />
        <Story />
        <Contact />
      </Suspense>
    </div>
  );
}
