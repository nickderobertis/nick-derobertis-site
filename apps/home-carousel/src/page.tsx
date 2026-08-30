import { siteBase } from "@site/data-access-core/site";
import { homeContent, readPaneState } from "@site/data-access-home";
import { CarouselState } from "./carousel-state";
import Skeleton from "./skeleton";
import { useCarousel } from "./use-carousel";
import "./carousel.css";

export default function HomeCarouselPage() {
  const state = readPaneState(
    typeof window === "undefined" ? "" : window.location.search,
  );
  const { active, move } = useCarousel(
    homeContent.carousel.length,
    state === "happy",
  );
  if (state === "loading") return <Skeleton />;
  if (state !== "happy") return <CarouselState name={state} />;
  /* v8 ignore next -- useCarousel only ever writes `active` modulo the story count, so it always names one of them; the fallback restores the type that indexing by a number drops. */
  const slide = homeContent.carousel[active] ?? homeContent.carousel[0];
  return (
    <section
      className="pane home-carousel"
      data-tone={slide.tone}
      aria-roledescription="carousel"
      aria-label="Featured work"
    >
      <button
        className="carousel-control previous"
        type="button"
        aria-label="Previous featured story"
        onClick={() => move(-1)}
      >
        ‹
      </button>
      <div className="carousel-copy" aria-live="polite">
        <h1>{slide.title}</h1>
        <p>{slide.description}</p>
        <a className="action" href={`${siteBase}${slide.link}`}>
          {slide.linkLabel}
        </a>
      </div>
      <button
        className="carousel-control next"
        type="button"
        aria-label="Next featured story"
        onClick={() => move(1)}
      >
        ›
      </button>
      <span className="carousel-position">
        Story {active + 1} of {homeContent.carousel.length}
      </span>
    </section>
  );
}
