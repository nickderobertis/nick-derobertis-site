import { render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import { SkillsState } from "./skills-state";

test("interrupts with an alert when the skills cannot be loaded", () => {
  render(<SkillsState name="error" />);

  const panel = screen.getByRole("alert");
  expect(
    within(panel).getByRole("heading", { name: "Skills unavailable" }),
  ).toBeInTheDocument();
  expect(
    within(panel).getByText(
      "Skills data could not be loaded. Please try again later.",
    ),
  ).toBeInTheDocument();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

test("reports a CV that lists no skills as a status rather than a failure", () => {
  render(<SkillsState name="empty" />);

  expect(screen.getByRole("status")).toHaveTextContent(
    "No skills are available.",
  );
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.queryByRole("heading")).not.toBeInTheDocument();
});
