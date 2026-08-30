import { siteBase } from "@site/data-access-core/site";
import { ActionLink, Card } from "@site/design-system";

/** One area of work, as the bundled home content records it. */
export interface MarketingCardModel {
  icon: string;
  title: string;
  description: string;
  link: string;
  linkLabel: string;
}

/**
 * One area-of-work card. Its heading carries the card, so the icon is drawn as
 * decoration and left out of the accessibility tree rather than read aloud as a
 * meaningless glyph before the title.
 */
export function MarketingCard({ card }: { card: MarketingCardModel }) {
  return (
    <Card className="marketing-card">
      <span className="card-icon" aria-hidden="true">
        {card.icon}
      </span>
      <h2>{card.title}</h2>
      <p>{card.description}</p>
      <ActionLink href={`${siteBase}${card.link}`}>{card.linkLabel}</ActionLink>
    </Card>
  );
}
