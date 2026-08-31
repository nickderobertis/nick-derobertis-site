import {
  buildAwardCards,
  calculateAwardsStats,
  selectedAwards,
} from "@site/data-access-awards";
import type { Awards } from "@site/data-access-core";
// eslint-disable-next-line @nx/enforce-module-boundaries -- The app deliberately initializes this shared library asynchronously at startup; this primitive still must be a static component dependency.
import { PageShell } from "@site/design-system";
import { AwardCard } from "./award-card";
import { AwardsState } from "./awards-state";
import { AwardsStatistics } from "./awards-statistics";
import { committedAwards } from "./committed-awards";
import Skeleton from "./skeleton";
import { preloadAwards, useAwards } from "./use-awards";
import { useAwardsView } from "./use-awards-view";
import "./awards.css";

// Hosts reach this through the remote's existing ./Page expose, so warming the
// pane costs no new federation surface.
export { preloadAwards as preload };

export default function AwardsPage({
  initialAwards = committedAwards,
  initialShowAll,
}: Readonly<{ initialAwards?: Awards; initialShowAll?: boolean }> = {}) {
  const state = useAwards(initialAwards);
  const showAll = useAwardsView(initialShowAll);
  if (state.name === "loading") return <Skeleton />;
  if (state.name !== "ready") return <AwardsState name={state.name} />;
  if (state.awards.length === 0) return <AwardsState name="empty" />;
  const awards = showAll ? state.awards : selectedAwards(state.awards);
  const label = showAll ? "Awards & honors" : "Selected awards";
  return (
    // llmlint: ignore[changed_behavior_has_e2e] awards/e2e/awards.spec.ts drives this pane's happy, empty, loading, and error scenarios through both standalone and host-composed URLs; the shared primitive's painted contract is additionally covered by the home-cards dual-path journey, so duplicating CSS assertions here would not exercise a distinct boundary.
    <PageShell className="awards-pane" aria-label={label}>
      <h2 className="visually-hidden">{label}</h2>
      <AwardsStatistics stats={calculateAwardsStats(awards)} />
      <div className="award-grid">
        {buildAwardCards(awards).map((award) => (
          <AwardCard award={award} key={award.id} />
        ))}
      </div>
    </PageShell>
  );
}
