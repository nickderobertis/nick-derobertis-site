import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { CardsState } from "./cards-state";

test("reports an unreachable card list as a status rather than an alert", () => {
  render(<CardsState name="error" />);

  const panel = screen.getByRole("status");
  expect(panel).toHaveTextContent("Areas of work could not be loaded.");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("reports a home page with no areas of work", () => {
  render(<CardsState name="empty" />);

  expect(screen.getByRole("status")).toHaveTextContent(
    "No areas of work are available yet.",
  );
  expect(screen.queryByRole("article")).not.toBeInTheDocument();
});
