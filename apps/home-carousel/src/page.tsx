import { homeContent, readPaneState } from "@site/data-access";
import { useEffect, useState } from "react";

function StateMessage({ state }: { state: "empty" | "loading" | "error" }) {
  const messages = {
    empty: "No featured stories are available yet.",
    loading: "Loading featured stories…",
    error: "Featured stories could not be loaded.",
  };
  return <output className="pane-state">{messages[state]}</output>;
}

export default function HomeCarouselPage() {
  const state = readPaneState(window.location.search);
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (state !== "happy") return;
    const timer = window.setInterval(
      () => setActive((current) => (current + 1) % homeContent.carousel.length),
      5000,
    );
    return () => window.clearInterval(timer);
  }, [state]);
  if (state !== "happy") return <StateMessage state={state} />;
  const slide = homeContent.carousel[active] ?? homeContent.carousel[0];
  const move = (offset: number) =>
    setActive(
      (current) =>
        (current + offset + homeContent.carousel.length) %
        homeContent.carousel.length,
    );
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
        <a className="action" href={`/nick-derobertis-site${slide.link}`}>
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
