import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { ContactState } from "./contact-state";

test("reports an unreachable channel list as a status rather than an alert", () => {
  render(<ContactState name="error" />);

  expect(screen.getByRole("status")).toHaveTextContent(
    "Contact options could not be loaded.",
  );
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("reports a home page with no way to get in touch", () => {
  render(<ContactState name="empty" />);

  expect(screen.getByRole("status")).toHaveTextContent(
    "No contact options are available.",
  );
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});
