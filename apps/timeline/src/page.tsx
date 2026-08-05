import { cvDataClient } from "@site/data-access-core";
import { previewState } from "./preview-state";
import Skeleton from "./skeleton";
import { TimelineChart } from "./timeline-chart";
import { TimelineState } from "./timeline-state";
import "./timeline.css";

export default function TimelinePage() {
  const state = previewState();
  if (state === "loading") return <Skeleton />;
  if (state === "error") return <TimelineState name="error" />;
  const entries = state === "empty" ? [] : cvDataClient.domain("timeline");
  return (
    <section className="timeline-pane" aria-labelledby="timeline-heading">
      <header>
        <h2 id="timeline-heading">Educated and Experienced</h2>
        <p>Explore positions in the timeline to learn more.</p>
      </header>
      {entries.length === 0 ? (
        <TimelineState name="empty" />
      ) : (
        <TimelineChart entries={entries} />
      )}
    </section>
  );
}
