import type { AwardsStats } from "@site/data-access-awards";

/**
 * The pane's totals. They are visually carried by the cards themselves, so this
 * list is hidden from sight and left in the accessibility tree, where it is the
 * only way to hear how many awards the grid holds and what years they span.
 */
export function AwardsStatistics({ stats }: { stats: AwardsStats }) {
  return (
    <dl className="visually-hidden" aria-label="Awards statistics">
      <div>
        <dt>Awards</dt>
        <dd>{stats.total}</dd>
      </div>
      <div>
        <dt>Years</dt>
        <dd>
          {stats.firstYear}–{stats.latestYear}
        </dd>
      </div>
      <div>
        <dt>With details</dt>
        <dd>{stats.withExtraInfo}</dd>
      </div>
    </dl>
  );
}
