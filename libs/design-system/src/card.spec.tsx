import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { Card } from "./card";

test("carries one record on the shared surface, named by its own heading", () => {
  render(
    <Card aria-labelledby="award-title">
      <h3 id="award-title">Best paper</h3>
    </Card>,
  );

  const card = screen.getByRole("article", { name: "Best paper" });
  expect(card.tagName).toBe("ARTICLE");
  expect(card).toHaveClass("card");
});

test("keeps the app's own modifier beside the shared surface class", () => {
  render(
    <Card className="software-card" aria-labelledby="project-title">
      <h2 id="project-title">pyexlatex</h2>
    </Card>,
  );

  expect(screen.getByRole("article", { name: "pyexlatex" })).toHaveClass(
    "card",
    "software-card",
  );
});

test("renders a card that is one item of a list as a list item", () => {
  render(
    <ul aria-label="Topics">
      <Card as="li">Portfolio theory</Card>
    </ul>,
  );

  const item = screen.getByRole("listitem");
  expect(item.tagName).toBe("LI");
  expect(item).toHaveClass("card");
});
