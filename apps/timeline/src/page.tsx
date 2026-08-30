import { timeline } from "@site/data-access-timeline";
import { PageShell, SectionHeading } from "@site/design-system";
import { previewState } from "./preview-state";
import Skeleton from "./skeleton";
import { TimelineChart } from "./timeline-chart";
import { TimelineState } from "./timeline-state";
import "./timeline.css";

export default function TimelinePage() {
  const state = previewState();
  if (state === "loading") return <Skeleton />;
  if (state === "error") return <TimelineState name="error" />;
  const entries = state === "empty" ? [] : timeline;
  return (
    <PageShell className="timeline-pane" aria-labelledby="timeline-heading">
      <SectionHeading
        title="Educated and Experienced"
        titleId="timeline-heading"
        description="Explore positions in the timeline to learn more."
      />
      {entries.length === 0 ? (
        <TimelineState name="empty" />
      ) : (
        <TimelineChart entries={entries} />
      )}
    </PageShell>
  );
}
