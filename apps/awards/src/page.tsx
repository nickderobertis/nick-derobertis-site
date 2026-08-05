import {
  buildAwardCards,
  calculateAwardsStats,
  selectedAwards,
} from "@site/data-access-awards";
import { AwardCard } from "./award-card";
import { AwardsState } from "./awards-state";
import { AwardsStatistics } from "./awards-statistics";
import Skeleton from "./skeleton";
import { preloadAwards, useAwards } from "./use-awards";
import "./awards.css";

// Hosts reach this through the remote's existing ./Page expose, so warming the
// pane costs no new federation surface.
export { preloadAwards as preload };

export default function AwardsPage() {
  const state = useAwards();
  if (state.name === "loading") return <Skeleton />;
  if (state.name !== "ready") return <AwardsState name={state.name} />;
  if (state.awards.length === 0) return <AwardsState name="empty" />;
  // The prerendered fragment has no location to read; a visitor who asks for
  // the full set arrives with the query only the client render can see.
  const showAll =
    new URLSearchParams(
      typeof window === "undefined" ? "" : window.location.search,
    ).get("awards-view") === "all";
  const awards = showAll ? state.awards : selectedAwards(state.awards);
  const label = showAll ? "Awards & honors" : "Selected awards";
  return (
    <section className="awards-pane" aria-label={label}>
      <h2 className="visually-hidden">{label}</h2>
      <AwardsStatistics stats={calculateAwardsStats(awards)} />
      <div className="award-grid">
        {buildAwardCards(awards).map((award) => (
          <AwardCard award={award} key={award.id} />
        ))}
      </div>
    </section>
  );
}
