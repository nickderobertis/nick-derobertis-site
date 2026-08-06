import { render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import { ResearchState } from "./research-state";

function livePanel(container: HTMLElement) {
  const panel = container.querySelector<HTMLElement>('[aria-live="polite"]');
  // The panel replaces content the visitor is already waiting on, so it has to
  // be announced when it arrives rather than sit there silently.
  if (!panel) throw new Error("The research state panel is not announced");
  return panel;
}

test("reports a CV with no research as an empty collection, not a failure", () => {
  const { container } = render(<ResearchState state="empty" />);

  const panel = livePanel(container);
  expect(
    within(panel).getByRole("heading", { name: "No research projects yet" }),
  ).toBeInTheDocument();
  expect(
    within(panel).getByText("New research will appear here."),
  ).toBeInTheDocument();
});

test("says the research collection could not be loaded when it fails", () => {
  const { container } = render(<ResearchState state="error" />);

  const panel = livePanel(container);
  expect(
    within(panel).getByRole("heading", { name: "Research is unavailable" }),
  ).toBeInTheDocument();
  expect(
    within(panel).getByText(
      "The research collection could not be loaded. Please try again later.",
    ),
  ).toBeInTheDocument();
  expect(screen.queryByRole("article")).not.toBeInTheDocument();
});
