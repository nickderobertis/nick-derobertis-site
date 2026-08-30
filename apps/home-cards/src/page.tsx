import { homeContent, readPaneState } from "@site/data-access-home";
// eslint-disable-next-line @nx/enforce-module-boundaries -- The app deliberately initializes this shared library asynchronously at startup; this primitive still must be a static component dependency.
import { PageShell } from "@site/design-system";
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
    <PageShell className="home-cards" contained aria-label="Areas of work">
      {homeContent.cards.map((card) => (
        <MarketingCard card={card} key={card.title} />
      ))}
    </PageShell>
  );
}
