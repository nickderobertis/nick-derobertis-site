import { siteBase } from "@site/data-access-core";
import { render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import { MarketingCard } from "./marketing-card";

const engineering = {
  icon: "⚙",
  title: "Engineering",
  description: "I turn hard problems into approachable, open-source tools.",
  link: "/software",
  linkLabel: "View software",
};

test("names the card by its heading and links on to that area of work", () => {
  render(<MarketingCard card={engineering} />);

  const card = screen.getByRole("article");
  expect(
    within(card).getByRole("heading", { name: "Engineering" }),
  ).toBeInTheDocument();
  expect(
    within(card).getByText(
      "I turn hard problems into approachable, open-source tools.",
    ),
  ).toBeInTheDocument();
  expect(
    within(card).getByRole("link", { name: "View software" }),
  ).toHaveAttribute("href", `${siteBase}/software`);
});

test("keeps the decorative glyph out of the card a visitor hears", () => {
  render(<MarketingCard card={engineering} />);

  // The glyph carries no meaning the heading does not already give, so a
  // screen reader must not announce it as part of the card.
  expect(screen.getByRole("article")).not.toHaveAccessibleName("⚙");
  expect(screen.queryByText("⚙")).toHaveAttribute("aria-hidden", "true");
});
