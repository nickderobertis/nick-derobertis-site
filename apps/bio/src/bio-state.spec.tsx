import { render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import { BioState } from "./bio-state";

test("interrupts with an alert when the biography cannot be displayed", () => {
  render(<BioState state="error" />);

  const panel = screen.getByRole("alert");
  expect(
    within(panel).getByRole("heading", { name: "Biography unavailable" }),
  ).toBeInTheDocument();
  expect(
    within(panel).getByText("The biography could not be displayed."),
  ).toBeInTheDocument();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

test("reports an unwritten biography as a status rather than a failure", () => {
  render(<BioState state="empty" />);

  const panel = screen.getByRole("status");
  expect(
    within(panel).getByRole("heading", { name: "Biography coming soon" }),
  ).toBeInTheDocument();
  expect(
    within(panel).getByText("There is no biography to show yet."),
  ).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
