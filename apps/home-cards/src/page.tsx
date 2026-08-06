import { homeContent, readPaneState } from "@site/data-access-home";
import { CardsState } from "./cards-state";
import { MarketingCard } from "./marketing-card";
import Skeleton from "./skeleton";
import "./cards.css";

export default function HomeCardsPage() {
  const state = readPaneState(
    typeof window === "undefined" ? "" : window.location.search,
  );
  if (state === "loading") return <Skeleton />;
  if (state !== "happy") return <CardsState name={state} />;
  return (
    <section className="pane home-cards" aria-label="Areas of work">
      {homeContent.cards.map((card) => (
        <MarketingCard card={card} key={card.title} />
      ))}
    </section>
  );
}
