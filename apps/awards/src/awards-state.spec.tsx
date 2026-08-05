import { render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import { AwardsState } from "./awards-state";

test("interrupts with an alert when the awards request fails", () => {
  render(<AwardsState name="error" />);

  const panel = screen.getByRole("alert");
  expect(
    within(panel).getByRole("heading", { name: "Awards unavailable" }),
  ).toBeInTheDocument();
  expect(
    within(panel).getByText(
      "Awards could not be loaded. Please try again later.",
    ),
  ).toBeInTheDocument();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

test("reports an empty award list as a status rather than a failure", () => {
  render(<AwardsState name="empty" />);

  const panel = screen.getByRole("status");
  expect(
    within(panel).getByRole("heading", { name: "No awards yet" }),
  ).toBeInTheDocument();
  expect(
    within(panel).getByText("New honors and achievements will appear here."),
  ).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
