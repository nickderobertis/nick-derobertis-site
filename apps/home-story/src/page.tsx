import { siteBase } from "@site/data-access-core/site";
import { homeContent, readPaneState } from "@site/data-access-home";
// eslint-disable-next-line @nx/enforce-module-boundaries -- The app deliberately initializes this shared library asynchronously at startup; this primitive still must be a static component dependency.
import { ActionLink, PageShell, SectionHeading } from "@site/design-system";
import Skeleton from "./skeleton";
import { StoryState } from "./story-state";
import "./story.css";

export default function HomeStoryPage() {
  const state = readPaneState(
    typeof window === "undefined" ? "" : window.location.search,
  );
  if (state === "loading") return <Skeleton />;
  if (state !== "happy") return <StoryState name={state} />;
  return (
    <PageShell className="story-pane" contained aria-labelledby="story-title">
      <div
        className="story-portrait"
        role="img"
        aria-label="Portrait of Nick DeRobertis"
      />
      <div className="story-copy">
        <SectionHeading
          eyebrow={homeContent.story.eyebrow}
          title={homeContent.story.title}
          titleId="story-title"
          description={homeContent.story.description}
        />
        <ActionLink href={`${siteBase}${homeContent.story.link}`}>
          {homeContent.story.linkLabel}
        </ActionLink>
      </div>
    </PageShell>
  );
}
