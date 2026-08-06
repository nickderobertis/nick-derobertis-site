import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import SoftwareSkeleton from "./skeleton";

test("announces that the projects are loading without claiming any exist", () => {
  render(<SoftwareSkeleton />);

  expect(
    screen.getByRole("status", { name: "Loading software" }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("article")).not.toBeInTheDocument();
  expect(screen.queryByRole("heading")).not.toBeInTheDocument();
});
