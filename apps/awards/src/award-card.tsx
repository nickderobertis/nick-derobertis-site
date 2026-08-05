import type { AwardCardModel } from "@site/data-access-awards";
import { AwardEmblem } from "./award-emblem";

/**
 * One award. Its heading names the card, so the parts list stays optional: an
 * award the CV records without details renders as the heading and its date.
 */
export function AwardCard({ award }: { award: AwardCardModel }) {
  return (
    <article className="award-card" aria-labelledby={`${award.id}-title`}>
      <div className="award-visual">
        <time dateTime={award.received}>{award.received}</time>
        <AwardEmblem icon={award.icon} />
      </div>
      <h3 id={`${award.id}-title`}>{award.title}</h3>
      {award.parts.length > 0 ? (
        <ul aria-label="Award parts">
          {award.parts.map((part) => (
            <li key={part}>{part}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
