import { render } from "@testing-library/react";
import { expect, test } from "vitest";
import { LaurelBranch } from "./laurel-branch";

// The wreath is decoration with no accessible name of its own, so what a
// visitor can check is the drawing: both halves carry the same stem and leaves,
// and only the second half is reflected across the emblem's 200-unit width.
function drawBranch(element: React.ReactElement) {
  const { container } = render(
    <svg viewBox="0 0 200 150" aria-hidden="true">
      {element}
    </svg>,
  );
  const branch = container.querySelector("g");
  if (!branch) throw new Error("LaurelBranch drew no group");
  return branch;
}

test("draws a stem carrying ten leaves", () => {
  const branch = drawBranch(<LaurelBranch />);

  expect(branch.querySelectorAll("path")).toHaveLength(1);
  expect(branch.querySelectorAll("ellipse")).toHaveLength(10);
  expect(branch.getAttribute("transform")).toBeNull();
});

test("reflects the same drawing to form the wreath's other half", () => {
  const mirrored = drawBranch(<LaurelBranch mirrored />);

  expect(mirrored.getAttribute("transform")).toBe(
    "translate(200 0) scale(-1 1)",
  );
  expect(mirrored.querySelectorAll("ellipse")).toHaveLength(10);
});
