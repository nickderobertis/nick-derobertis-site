import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import HomeSkeleton from "./skeleton";

test("announces that the home page is loading without claiming any pane", () => {
  render(<HomeSkeleton />);

  expect(
    screen.getByRole("status", { name: "Loading home" }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});
