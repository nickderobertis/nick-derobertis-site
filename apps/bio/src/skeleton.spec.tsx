import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import BioSkeleton from "./skeleton";

test("announces that the biography is loading without claiming any of it", () => {
  render(<BioSkeleton />);

  expect(
    screen.getByRole("status", { name: "Loading biography" }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("heading")).not.toBeInTheDocument();
});
