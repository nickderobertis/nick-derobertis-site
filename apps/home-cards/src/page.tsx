import { siteBase } from "@site/data-access-core";
import { homeContent, readPaneState } from "@site/data-access-home";

export default function HomeCardsPage() {
  const state = readPaneState(window.location.search);
  if (state === "loading")
    return <output className="pane-state">Loading areas of work…</output>;
  if (state === "error")
    return (
      <output className="pane-state">Areas of work could not be loaded.</output>
    );
  if (state === "empty")
    return (
      <output className="pane-state">
        No areas of work are available yet.
      </output>
    );
  return (
    <section className="pane home-cards" aria-label="Areas of work">
      {homeContent.cards.map((card) => (
        <article className="marketing-card" key={card.title}>
          <span className="card-icon" aria-hidden="true">
            {card.icon}
          </span>
          <h2>{card.title}</h2>
          <p>{card.description}</p>
          <a className="action" href={`${siteBase}${card.link}`}>
            {card.linkLabel}
          </a>
        </article>
      ))}
    </section>
  );
}
