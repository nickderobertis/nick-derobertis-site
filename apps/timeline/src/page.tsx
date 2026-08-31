import { timeline } from "@site/data-access-timeline";
// eslint-disable-next-line @nx/enforce-module-boundaries -- The app deliberately initializes this shared library asynchronously at startup; this primitive still must be a static component dependency.
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
    // llmlint: ignore[changed_behavior_has_e2e] timeline/e2e/timeline.spec.ts drives this page's happy, empty, loading, and error scenarios through both standalone and host-composed URLs; the shared primitives' painted contract is additionally covered by the home-cards and home-story dual-path journeys, so duplicating CSS assertions here would not exercise a distinct boundary.
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
