import {
  buildAwardCards,
  calculateAwardsStats,
  selectedAwards,
} from "@site/data-access";
import { useAwards } from "./use-awards";
import "./awards.css";

function State({ name }: { name: "loading" | "error" | "empty" }) {
  const copy =
    name === "loading"
      ? ["Loading awards…", "Gathering honors and achievements."]
      : name === "error"
        ? [
            "Awards unavailable",
            "Awards could not be loaded. Please try again later.",
          ]
        : ["No awards yet", "New honors and achievements will appear here."];
  return (
    <section
      className="awards-state"
      role={name === "error" ? "alert" : "status"}
    >
      <h2>{copy[0]}</h2>
      <p>{copy[1]}</p>
    </section>
  );
}

export default function AwardsPage() {
  const state = useAwards();
  if (state.name !== "ready") return <State name={state.name} />;
  if (state.awards.length === 0) return <State name="empty" />;
  const showAll =
    new URLSearchParams(window.location.search).get("awards-view") === "all";
  const awards = showAll ? state.awards : selectedAwards(state.awards);
  const cards = buildAwardCards(awards);
  const stats = calculateAwardsStats(awards);
  return (
    <section className="awards-pane" aria-labelledby="awards-heading">
      <header className="awards-intro">
        <p className="awards-eyebrow">Recognition</p>
        <h2 id="awards-heading">
          {showAll ? "Awards & honors" : "Selected awards"}
        </h2>
        <dl className="awards-stats" aria-label="Awards statistics">
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
      </header>
      <div className="award-grid">
        {cards.map((award) => (
          <article
            className="award-card"
            aria-labelledby={`${award.id}-title`}
            key={award.id}
          >
            <div className="award-laurel" aria-hidden="true">
              <span>❧</span>
              <time>{award.received}</time>
              <span>❧</span>
            </div>
            <h3 id={`${award.id}-title`}>{award.title}</h3>
            {award.extraInfo ? (
              <p className="award-extra">{award.extraInfo}</p>
            ) : null}
            {award.parts.length > 1 ? (
              <ul aria-label="Award parts">
                {award.parts.map((part) => (
                  <li key={part}>{part}</li>
                ))}
              </ul>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
