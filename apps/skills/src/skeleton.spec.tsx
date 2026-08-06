import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import SkillsSkeleton from "./skeleton";

test("announces that skills are loading without claiming any exist", () => {
  render(<SkillsSkeleton />);

  expect(
    screen.getByRole("status", { name: "Loading skills" }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(screen.queryByRole("heading")).not.toBeInTheDocument();
});
