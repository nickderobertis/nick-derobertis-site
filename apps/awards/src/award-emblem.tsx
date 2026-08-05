import { AwardIcon, type AwardIconName } from "./award-icon";
import { LaurelBranch } from "./laurel-branch";

/**
 * The wreathed mark on an award card. It is decoration for the card's own
 * heading, so it stays out of the accessibility tree rather than reading its
 * lettering into the card's accessible name.
 */
export function AwardEmblem({ icon }: { icon: AwardIconName }) {
  return (
    <svg className="award-emblem" viewBox="0 0 200 150" aria-hidden="true">
      <LaurelBranch />
      <LaurelBranch mirrored />
      <AwardIcon name={icon} />
    </svg>
  );
}
