import { calculateAwardsStats, selectedAwards } from "@site/data-access-awards";
import { cvDataClient } from "@site/data-access-core/bundled";
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { AwardsStatistics } from "./awards-statistics";

function readStatistics() {
  return {
    terms: screen.getAllByRole("term").map((term) => term.textContent),
    values: screen
      .getAllByRole("definition")
      .map((definition) => definition.textContent),
  };
}

test("reads out the totals and span of the awards on show", () => {
  const awards = cvDataClient.domain("awards");

  render(<AwardsStatistics stats={calculateAwardsStats(awards)} />);

  expect(readStatistics()).toEqual({
    terms: ["Awards", "Years", "With details"],
    values: ["7", "2010–2019", "4"],
  });
});

test("counts only the awards the selected view puts on show", () => {
  const awards = selectedAwards(cvDataClient.domain("awards"));

  render(<AwardsStatistics stats={calculateAwardsStats(awards)} />);

  expect(readStatistics().values).toEqual(["4", "2013–2016", "1"]);
});

test("reads an empty span rather than a range when no award carries a year", () => {
  render(
    <AwardsStatistics
      stats={{ total: 0, withExtraInfo: 0, firstYear: null, latestYear: null }}
    />,
  );

  expect(readStatistics().values).toEqual(["0", "–", "0"]);
});
