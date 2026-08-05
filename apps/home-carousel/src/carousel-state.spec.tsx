import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { CarouselState } from "./carousel-state";

test("reports an unreachable rotation as a status rather than an alert", () => {
  render(<CarouselState name="error" />);

  expect(screen.getByRole("status")).toHaveTextContent(
    "Featured stories could not be loaded.",
  );
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("reports a home page with no featured stories", () => {
  render(<CarouselState name="empty" />);

  expect(screen.getByRole("status")).toHaveTextContent(
    "No featured stories are available yet.",
  );
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
