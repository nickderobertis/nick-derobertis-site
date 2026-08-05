import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { AwardEmblem } from "./award-emblem";

const hiddenSubtree = "[aria-hidden='true'], [aria-hidden='true'] *";

test("wreathes the mark the award was given for", () => {
  const { container } = render(<AwardEmblem icon="gmat" />);

  const emblem = container.querySelector("svg.award-emblem");
  expect(emblem?.querySelectorAll(":scope > g")).toHaveLength(3);
  expect(
    [...(emblem?.querySelectorAll(":scope > g[transform]") ?? [])].map(
      (group) => group.getAttribute("transform"),
    ),
  ).toContain("translate(200 0) scale(-1 1)");
});

test("keeps its lettering out of what a screen reader reads on the card", () => {
  render(
    <article aria-labelledby="gmat-title">
      <AwardEmblem icon="gmat" />
      <h3 id="gmat-title">Graduate Management Admission Test (GMAT)</h3>
    </article>,
  );

  expect(
    screen.getByRole("article", {
      name: "Graduate Management Admission Test (GMAT)",
    }),
  ).toBeInTheDocument();
  // The emblem spells "G MAT"; announced beside the heading it would read as a
  // second, garbled title, so nothing inside it may reach the visitor.
  expect(
    screen.queryByText("MAT", { ignore: hiddenSubtree }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByText("MAT", { ignore: "script, style" }),
  ).toBeInTheDocument();
});
