import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import HomeContactSkeleton from "./skeleton";

test("announces that the contact options are loading without offering any", () => {
  render(<HomeContactSkeleton />);

  expect(
    screen.getByRole("status", { name: "Loading contact options" }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
  expect(screen.queryByRole("heading")).not.toBeInTheDocument();
});
