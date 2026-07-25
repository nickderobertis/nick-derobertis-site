import { siteBase } from "@site/data-access-core";
import { homeContent, readPaneState } from "@site/data-access-home";
import Skeleton from "./skeleton";
import "./story.css";

export default function HomeStoryPage() {
  const state = readPaneState(
    typeof window === "undefined" ? "" : window.location.search,
  );
  if (state === "loading") return <Skeleton />;
  if (state === "error")
    return (
      <output className="pane-state">Nick’s story could not be loaded.</output>
    );
  if (state === "empty")
    return <output className="pane-state">No story is available yet.</output>;
  return (
    <section className="pane story-pane" aria-labelledby="story-title">
      <div
        className="story-portrait"
        role="img"
        aria-label="Portrait of Nick DeRobertis"
      />
      <div className="story-copy">
        <p className="eyebrow">{homeContent.story.eyebrow}</p>
        <h2 id="story-title">{homeContent.story.title}</h2>
        <p>{homeContent.story.description}</p>
        <a className="action" href={`${siteBase}${homeContent.story.link}`}>
          {homeContent.story.linkLabel}
        </a>
      </div>
    </section>
  );
}
