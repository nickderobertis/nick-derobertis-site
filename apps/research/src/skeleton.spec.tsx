import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import ResearchSkeleton from "./skeleton";

test("announces that the research is loading without claiming any of it", () => {
  render(<ResearchSkeleton />);

  expect(
    screen.getByRole("status", { name: "Loading research" }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("article")).not.toBeInTheDocument();
  expect(screen.queryByRole("heading")).not.toBeInTheDocument();
});
