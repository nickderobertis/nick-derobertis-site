import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import AwardsSkeleton from "./skeleton";

test("announces that awards are loading without claiming any exist", () => {
  render(<AwardsSkeleton />);

  expect(
    screen.getByRole("status", { name: "Loading awards" }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("article")).not.toBeInTheDocument();
  expect(screen.queryByRole("heading")).not.toBeInTheDocument();
});
