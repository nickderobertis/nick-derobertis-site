import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import HomeStorySkeleton from "./skeleton";

test("announces that the story is loading without claiming any of it", () => {
  render(<HomeStorySkeleton />);

  expect(
    screen.getByRole("status", { name: "Loading story" }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
});
