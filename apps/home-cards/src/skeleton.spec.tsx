import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import HomeCardsSkeleton from "./skeleton";

test("announces that the areas of work are loading without claiming any exist", () => {
  render(<HomeCardsSkeleton />);

  expect(
    screen.getByRole("status", { name: "Loading areas of work" }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("article")).not.toBeInTheDocument();
  expect(screen.queryByRole("heading")).not.toBeInTheDocument();
});
