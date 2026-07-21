import type { Awards } from "@site/data-access-core";
import { describe, expect, it } from "vitest";
import {
  buildAwardCards,
  calculateAwardsStats,
  selectedAwards,
} from "./awards";

const awards: Awards = [
  {
    id: "finance-student-of-the-year",
    received_label: "2013",
    title: "Finance Student of the Year",
  },
  {
    details: "780 | 99.6 percentile",
    id: "graduate-management-admission-test-gmat-score",
    received_label: "2014",
    title: "Graduate Management Admission Test (GMAT) Score",
  },
  { id: "not-selected", received_label: "2010-2019", title: "Another Award" },
];

describe("awards view models", () => {
  it("builds optional card parts and display values", () => {
    expect(buildAwardCards(awards)).toEqual([
      {
        id: "finance-student-of-the-year",
        title: "Finance Student of the Year",
        received: "2013",
        icon: "student",
        parts: ["Virginia Commonwealth University"],
      },
      {
        id: "graduate-management-admission-test-gmat-score",
        title: "Graduate Management Admission Test (GMAT)",
        received: "2014",
        icon: "gmat",
        parts: ["780 score", "99.6 percentile"],
      },
      {
        id: "not-selected",
        title: "Another Award",
        received: "2010-2019",
        icon: "teaching",
        parts: [],
      },
    ]);
    expect(
      buildAwardCards([
        {
          id: "dated",
          received_date: "2020-01-02",
          title:
            "CFA Global Investment Research Challenge – Global Semi-Finalist",
        },
        {
          details: "",
          id: "undated",
          title: "Warrington College of Business Ph.D. Student Teaching Award",
        },
      ]),
    ).toEqual([
      {
        id: "dated",
        title:
          "CFA Global Investment Research Challenge – Global Semi-Finalist",
        received: "2020-01-02",
        icon: "teaching",
        parts: [],
      },
      {
        id: "undated",
        title: "Warrington College of Business Ph.D. Student Teaching Award",
        received: "Date not listed",
        icon: "teaching",
        parts: [],
      },
    ]);
  });

  it("selects featured awards and calculates the date range", () => {
    expect(selectedAwards(awards).map(({ id }) => id)).toEqual([
      "graduate-management-admission-test-gmat-score",
      "finance-student-of-the-year",
    ]);
    expect(calculateAwardsStats(awards)).toEqual({
      total: 3,
      withExtraInfo: 1,
      firstYear: 2010,
      latestYear: 2019,
    });
    expect(calculateAwardsStats([])).toEqual({
      total: 0,
      withExtraInfo: 0,
      firstYear: null,
      latestYear: null,
    });
    expect(
      calculateAwardsStats([
        { id: "dated", received_date: "2020-01-02", title: "Dated" },
        { id: "unknown", title: "Unknown" },
      ]),
    ).toEqual({
      total: 2,
      withExtraInfo: 0,
      firstYear: 2020,
      latestYear: 2020,
    });
  });
});
