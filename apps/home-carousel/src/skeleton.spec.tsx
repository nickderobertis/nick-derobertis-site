import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import HomeCarouselSkeleton from "./skeleton";

test("announces that the featured work is loading without claiming a story", () => {
  render(<HomeCarouselSkeleton />);

  expect(
    screen.getByRole("status", { name: "Loading featured work" }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
