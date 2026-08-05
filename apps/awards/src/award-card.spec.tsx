import { buildAwardCards } from "@site/data-access-awards";
import { cvDataClient } from "@site/data-access-core";
import { render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import { AwardCard } from "./award-card";

const cards = buildAwardCards(cvDataClient.domain("awards"));

function cardFor(id: string) {
  const card = cards.find((candidate) => candidate.id === id);
  if (!card) throw new Error(`The CV no longer records the ${id} award`);
  return card;
}

test("names itself by its award and lists the detail the CV records", () => {
  render(
    <AwardCard
      award={cardFor("graduate-management-admission-test-gmat-score")}
    />,
  );

  const card = screen.getByRole("article", {
    name: "Graduate Management Admission Test (GMAT)",
  });
  expect(
    within(card).getByRole("heading", {
      level: 3,
      name: "Graduate Management Admission Test (GMAT)",
    }),
  ).toBeInTheDocument();
  expect(within(card).getByText("2014")).toBeInTheDocument();
  expect(
    within(card)
      .getByRole("list", { name: "Award parts" })
      .querySelectorAll("li"),
  ).toHaveLength(2);
  expect(
    within(card)
      .getAllByRole("listitem")
      .map((part) => part.textContent),
  ).toEqual(["780 score", "99.6 percentile"]);
});

test("omits the parts list for an award the CV records without detail", () => {
  render(
    <AwardCard
      award={{
        id: "an-honour-with-no-detail",
        title: "An honour with no detail",
        received: "Date not listed",
        parts: [],
        icon: "teaching",
      }}
    />,
  );

  const card = screen.getByRole("article", {
    name: "An honour with no detail",
  });
  expect(within(card).getByText("Date not listed")).toBeInTheDocument();
  expect(
    screen.queryByRole("list", { name: "Award parts" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
});
