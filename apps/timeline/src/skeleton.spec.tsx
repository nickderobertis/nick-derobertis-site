import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import TimelineSkeleton from "./skeleton";

test("announces that the timeline is loading without claiming any history", () => {
  render(<TimelineSkeleton />);

  expect(
    screen.getByRole("status", { name: "Loading timeline" }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("article")).not.toBeInTheDocument();
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  expect(screen.queryByRole("heading")).not.toBeInTheDocument();
});
