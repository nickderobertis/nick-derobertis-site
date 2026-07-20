import type { AwardIcon } from "@site/design-system";
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
  readonly parts: readonly string[];
  readonly icon: AwardIcon;
}

export interface AwardsStats {
  readonly total: number;
  readonly withExtraInfo: number;
  readonly firstYear: number | null;
  readonly latestYear: number | null;
}

interface AwardPresentation {
  readonly icon: AwardIcon;
  readonly parts: readonly string[];
  readonly title?: string;
}

const AWARD_PRESENTATION: Readonly<Record<string, AwardPresentation>> = {
  "warrington-college-of-business-ph-d-student-teaching-award": {
    icon: "teaching",
    title: "Ph.D. Student Teaching Award",
    parts: ["University of Florida", "Warrington College of Business"],
  },
  "cfa-global-investment-research-challenge-global-semi-finalist": {
    icon: "cfa",
    title: "Global Semi-Finalist",
    parts: ["CFA Challenge", "CFA Institute"],
  },
  "graduate-management-admission-test-gmat-score": {
    icon: "gmat",
    title: "Graduate Management Admission Test (GMAT)",
    parts: [],
  },
  "finance-student-of-the-year": {
    icon: "student",
    parts: ["Virginia Commonwealth University"],
  },
  "warrington-finance-ph-d-research-grants": {
    icon: "scholarship",
    parts: ["University of Florida", "Warrington College of Business"],
  },
  "alcoa-foundation-community-scholarship": {
    icon: "scholarship",
    parts: ["Alcoa Foundation"],
  },
  "vcu-school-of-business-scholarship": {
    icon: "scholarship",
    parts: ["Virginia Commonwealth University"],
  },
};

function awardParts(award: Award) {
  const parts = (award.details ?? "")
    .replaceAll("\\$", "$")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
  return award.id === "graduate-management-admission-test-gmat-score" &&
    parts[0]
    ? [`${parts[0]} score`, ...parts.slice(1)]
    : parts;
}

export function buildAwardCards(awards: Awards): readonly AwardCardModel[] {
  return awards.map((award) => {
    const presentation = AWARD_PRESENTATION[award.id] ?? {
      icon: "teaching" as const,
      parts: [],
    };
    return {
      id: award.id,
      title: presentation.title ?? award.title,
      received:
        award.received_label ?? award.received_date ?? "Date not listed",
      icon: presentation.icon,
      parts: [...awardParts(award), ...presentation.parts],
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
