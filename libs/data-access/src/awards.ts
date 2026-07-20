import type { Award, Awards } from "../vendor/codegen";

const SELECTED_AWARD_IDS = [
  "warrington-college-of-business-ph-d-student-teaching-award",
  "cfa-global-investment-research-challenge-global-semi-finalist",
  "graduate-management-admission-test-gmat-score",
  "finance-student-of-the-year",
] as const;

export interface AwardCardModel {
  readonly id: string;
  readonly title: string;
  readonly received: string;
  readonly extraInfo: string | null;
  readonly parts: readonly string[];
}

export interface AwardsStats {
  readonly total: number;
  readonly withExtraInfo: number;
  readonly firstYear: number | null;
  readonly latestYear: number | null;
}

function displayTitle(title: string) {
  return title
    .replace("Warrington College of Business ", "")
    .replace("CFA Global Investment Research Challenge – ", "")
    .replace("Graduate Management Admission Test (GMAT) Score", "GMAT Score");
}

function awardParts(award: Award) {
  return (award.details ?? "")
    .replaceAll("\\$", "$")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function buildAwardCards(awards: Awards): readonly AwardCardModel[] {
  return awards.map((award) => {
    const parts = awardParts(award);
    return {
      id: award.id,
      title: displayTitle(award.title),
      received:
        award.received_label ?? award.received_date ?? "Date not listed",
      extraInfo: parts.length > 0 ? parts.join(" · ") : null,
      parts,
    };
  });
}

export function selectedAwards(awards: Awards): Awards {
  const awardsById = new Map(awards.map((award) => [award.id, award]));
  return SELECTED_AWARD_IDS.flatMap((id) => {
    const award = awardsById.get(id);
    return award ? [award] : [];
  });
}

export function calculateAwardsStats(awards: Awards): AwardsStats {
  const years = awards.flatMap(
    (award) =>
      (award.received_label ?? award.received_date ?? "")
        .match(/\d{4}/g)
        ?.map(Number) ?? [],
  );
  return {
    total: awards.length,
    withExtraInfo: awards.filter((award) => award.details).length,
    firstYear: years.length > 0 ? Math.min(...years) : null,
    latestYear: years.length > 0 ? Math.max(...years) : null,
  };
}
