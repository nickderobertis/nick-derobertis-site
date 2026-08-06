import { render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import { TimelineState } from "./timeline-state";

test("interrupts with an alert when the timeline cannot be loaded", () => {
  render(<TimelineState name="error" />);

  const panel = screen.getByRole("alert");
  expect(
    within(panel).getByRole("heading", { name: "Timeline unavailable" }),
  ).toBeInTheDocument();
  expect(
    within(panel).getByText(
      "Timeline data could not be loaded. Please try again later.",
    ),
  ).toBeInTheDocument();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

test("reports a CV with no history as a status rather than a failure", () => {
  render(<TimelineState name="empty" />);

  expect(screen.getByRole("status")).toHaveTextContent(
    "No education or employment entries are available.",
  );
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.queryByRole("heading")).not.toBeInTheDocument();
});
