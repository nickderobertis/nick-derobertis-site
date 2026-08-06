import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import CoursesSkeleton from "./skeleton";

test("announces that the courses are loading without claiming any exist", () => {
  render(<CoursesSkeleton />);

  expect(
    screen.getByRole("status", { name: "Loading courses" }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("article")).not.toBeInTheDocument();
  expect(screen.queryByRole("heading")).not.toBeInTheDocument();
});
