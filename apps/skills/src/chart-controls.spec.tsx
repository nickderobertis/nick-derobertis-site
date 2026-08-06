import type { SkillTreeNode } from "@site/data-access-skills";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { ChartControls } from "./chart-controls";

function node(id: string, title: string): SkillTreeNode {
  return {
    children: [],
    experience: "Proficient",
    firstUsed: null,
    hours: null,
    id,
    level: 3,
    title,
  };
}

const programming = node("programming", "Programming");
const frameworks = node("frameworks", "Frameworks");

test("offers a keyboard route into every category the chart is drawing", () => {
  render(
    <ChartControls
      active={null}
      categories={[programming, frameworks]}
      onSelect={vi.fn()}
      onSpotlight={vi.fn()}
    />,
  );

  expect(
    screen.getAllByRole("button").map((button) => button.textContent),
  ).toEqual(["Explore Programming category", "Explore Frameworks category"]);
});

test("offers the way back out once a category is expanded", () => {
  render(
    <ChartControls
      active={programming}
      categories={[programming]}
      onSelect={vi.fn()}
      onSpotlight={vi.fn()}
    />,
  );

  expect(
    screen.getByRole("button", { name: "Zoom out from Programming" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /^Explore/ }),
  ).not.toBeInTheDocument();
});

test("hands its category over when a visitor activates it", () => {
  const onSelect = vi.fn();
  render(
    <ChartControls
      active={null}
      categories={[programming, frameworks]}
      onSelect={onSelect}
      onSpotlight={vi.fn()}
    />,
  );

  fireEvent.click(
    screen.getByRole("button", { name: "Explore Frameworks category" }),
  );

  expect(onSelect).toHaveBeenCalledWith(frameworks);
});

test("spotlights a category for the keyboard as the focus ring reaches it", () => {
  const onSpotlight = vi.fn();
  render(
    <ChartControls
      active={null}
      categories={[programming]}
      onSelect={vi.fn()}
      onSpotlight={onSpotlight}
    />,
  );
  const control = screen.getByRole("button", {
    name: "Explore Programming category",
  });

  control.focus();
  expect(document.activeElement).toBe(control);
  expect(onSpotlight).toHaveBeenLastCalledWith(programming);

  fireEvent.blur(control);
  expect(onSpotlight).toHaveBeenLastCalledWith(null);
});

test("spotlights the same category for a pointer resting on it", () => {
  const onSpotlight = vi.fn();
  render(
    <ChartControls
      active={null}
      categories={[programming]}
      onSelect={vi.fn()}
      onSpotlight={onSpotlight}
    />,
  );
  const control = screen.getByRole("button", {
    name: "Explore Programming category",
  });

  fireEvent.pointerOver(control);
  expect(onSpotlight).toHaveBeenLastCalledWith(programming);

  fireEvent.pointerOut(control);
  expect(onSpotlight).toHaveBeenLastCalledWith(null);
});
