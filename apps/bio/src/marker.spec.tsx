import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { Marker } from "./marker";

test("keeps its glyph out of the name a heading is announced by", () => {
  render(
    <h3>
      Continuous Learning <Marker>💡</Marker>
    </h3>,
  );

  // The glyph is drawn, but a screen reader must announce the heading without
  // it: "Continuous Learning light bulb" is noise the sighted reader never gets.
  expect(
    screen.getByRole("heading", { name: "Continuous Learning" }),
  ).toBeInTheDocument();
  expect(screen.getByText("💡")).toHaveAttribute("aria-hidden", "true");
});
