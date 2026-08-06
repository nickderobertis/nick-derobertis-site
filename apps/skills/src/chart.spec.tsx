import type { SkillTree, SkillTreeNode } from "@site/data-access-skills";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { Chart } from "./chart";

function node(
  id: string,
  title: string,
  children: SkillTreeNode[] = [],
): SkillTreeNode {
  return {
    children,
    experience: "High Aptitude",
    firstUsed: null,
    hours: null,
    id,
    level: 5,
    title,
  };
}

const python = node("python", "Python");
const rust = node("rust", "Rust");
const programming = node("programming", "Programming", [python, rust]);
const frameworks = node("frameworks", "Frameworks", [node("react", "React")]);
const presentation = node("presentation", "Presentation");
const tree: SkillTree = {
  children: [programming, frameworks, presentation],
  skillCount: 3,
  title: "Skills",
};

/**
 * Every sector the chart draws, by the name a screen reader announces for it.
 * The sunburst is one SVG, so this list is the only way to say which slices of
 * the tree a visitor is actually looking at.
 */
function sectorNames() {
  return screen
    .getAllByLabelText(/(?: category, \d+ skills|, level \d+)$/)
    .map((sector) => sector.getAttribute("aria-label"));
}

/**
 * Presses Enter on a control the way a keyboard visitor reaches it. jsdom
 * dispatches the key events but never runs a button's activation behaviour, so
 * the click a browser synthesises from Enter is dispatched here too;
 * apps/skills/e2e/skills.spec.ts drives the real key press in a real browser.
 */
function pressEnter(control: HTMLElement) {
  act(() => control.focus());
  fireEvent.keyDown(control, { key: "Enter" });
  fireEvent.click(control);
  fireEvent.keyUp(control, { key: "Enter" });
}

function stats() {
  return screen.queryByRole("complementary", { name: "Skill stats" });
}

test("draws every category and every skill beneath it", () => {
  render(<Chart tree={tree} />);

  expect(
    screen.getByRole("img", { name: "Skills sunburst chart" }),
  ).toBeInTheDocument();
  expect(sectorNames()).toEqual([
    "Programming category, 2 skills",
    "Python, level 5",
    "Rust, level 5",
    "Frameworks category, 1 skills",
    "React, level 5",
    // A category the CV lists no skills under still gets an outer sector of its
    // own, so it stays visible rather than collapsing out of the chart.
    "Presentation category, 0 skills",
    "Presentation, level 5",
  ]);
  expect(
    screen.getByText("Activate an inner category to drill down."),
  ).toBeInTheDocument();
});

test("reveals a skill's stats to the pointer resting on its sector", () => {
  render(<Chart tree={tree} />);
  expect(stats()).not.toBeInTheDocument();

  fireEvent.pointerOver(screen.getByLabelText("Python, level 5"));

  expect(stats()).toHaveTextContent("Python");
  expect(stats()).toHaveTextContent("High Aptitude");

  fireEvent.pointerOut(screen.getByLabelText("Python, level 5"));

  expect(stats()).not.toBeInTheDocument();
});

test("reveals a category's own stats from its inner-ring sector", () => {
  render(<Chart tree={tree} />);
  const sector = screen.getByLabelText("Programming category, 2 skills");

  fireEvent.pointerOver(sector);

  expect(stats()).toHaveTextContent("Programming");

  fireEvent.pointerOut(sector);

  expect(stats()).not.toBeInTheDocument();
});

test("reveals the same stats to a keyboard reaching the category's control", () => {
  render(<Chart tree={tree} />);
  const control = screen.getByRole("button", {
    name: "Explore Frameworks category",
  });

  act(() => control.focus());

  expect(document.activeElement).toBe(control);
  expect(stats()).toHaveTextContent("Frameworks");

  fireEvent.blur(control);

  expect(stats()).not.toBeInTheDocument();
});

test("drills into a category a visitor clicks, and back out again", () => {
  render(<Chart tree={tree} />);

  fireEvent.click(
    screen.getByRole("button", { name: "Explore Programming category" }),
  );

  expect(sectorNames()).toEqual([
    "Programming category, 2 skills",
    "Python, level 5",
    "Rust, level 5",
  ]);
  expect(screen.getByText("Programming")).toBeInTheDocument();
  expect(
    screen.getByText(
      "Programming expanded. Activate the center category to zoom out.",
    ),
  ).toBeInTheDocument();

  fireEvent.click(
    screen.getByRole("button", { name: "Zoom out from Programming" }),
  );

  expect(sectorNames()).toHaveLength(7);
  expect(
    screen.getByRole("button", { name: "Explore Frameworks category" }),
  ).toBeInTheDocument();
});

test("drills into a category from the keyboard alone", () => {
  render(<Chart tree={tree} />);

  pressEnter(
    screen.getByRole("button", { name: "Explore Frameworks category" }),
  );

  expect(sectorNames()).toEqual([
    "Frameworks category, 1 skills",
    "React, level 5",
  ]);

  pressEnter(screen.getByRole("button", { name: "Zoom out from Frameworks" }));

  expect(sectorNames()).toHaveLength(7);
});
