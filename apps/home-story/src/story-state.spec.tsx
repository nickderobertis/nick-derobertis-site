import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { StoryState } from "./story-state";

test("reports an unreachable story as a status rather than an alert", () => {
  render(<StoryState name="error" />);

  expect(screen.getByRole("status")).toHaveTextContent(
    "Nick’s story could not be loaded.",
  );
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("reports a home page with no story written yet", () => {
  render(<StoryState name="empty" />);

  expect(screen.getByRole("status")).toHaveTextContent(
    "No story is available yet.",
  );
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
});
