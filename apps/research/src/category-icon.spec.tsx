import { research } from "@site/data-access-research";
import { render } from "@testing-library/react";
import { expect, test } from "vitest";
import { CategoryIcon } from "./category-icon";

const categories = research.categories ?? [];

function drawMark(id: string) {
  const { container } = render(<CategoryIcon id={id} />);
  const mark = container.querySelector("svg");
  if (!mark) throw new Error(`CategoryIcon drew nothing for ${id}`);
  return mark;
}

test("keeps the mark out of the accessibility tree beside the category's name", () => {
  // The list item already reads out the category name, so announcing the mark
  // would repeat it as an unnamed graphic.
  expect(drawMark("liquidity")).toHaveAttribute("aria-hidden", "true");
});

test("gives the same category the same mark wherever it is shown", () => {
  expect(drawMark("options").innerHTML).toBe(drawMark("options").innerHTML);
  expect(drawMark("equity").innerHTML).not.toBe(drawMark("options").innerHTML);
});

test("draws every category the CV records, across all four marks", () => {
  const drawings = categories.map(({ id }) => drawMark(id).innerHTML);

  expect(categories.length).toBeGreaterThan(0);
  expect(drawings.every((drawing) => drawing.length > 0)).toBe(true);
  // A category that fell through every variant would render an empty frame, so
  // the count of distinct marks is what proves the whole set is drawn.
  expect(new Set(drawings).size).toBe(4);
});
