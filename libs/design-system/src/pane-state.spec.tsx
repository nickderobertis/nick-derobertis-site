import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { PaneState } from "./pane-state";

test("announces the replacement politely rather than as an interruption", () => {
  render(<PaneState>No areas of work are available yet.</PaneState>);

  const state = screen.getByRole("status");
  expect(state.tagName).toBe("OUTPUT");
  expect(state).toHaveClass("pane-state");
  expect(state).toHaveTextContent("No areas of work are available yet.");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("keeps the pane's own class beside the shared state class", () => {
  render(<PaneState className="cards-state">Nothing yet.</PaneState>);

  expect(screen.getByRole("status")).toHaveClass("pane-state", "cards-state");
});
