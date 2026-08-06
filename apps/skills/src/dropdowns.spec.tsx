import type { SkillTree, SkillTreeNode } from "@site/data-access-skills";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { Dropdowns } from "./dropdowns";

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

const tree: SkillTree = {
  children: [
    node("programming", "Programming", [
      node("python", "Python"),
      node("rust", "Rust"),
    ]),
    node("frameworks", "Frameworks", [node("react", "React")]),
    node("presentation", "Presentation"),
  ],
  skillCount: 3,
  title: "Skills",
};

function selects() {
  return {
    category: screen.getByLabelText("Category", { exact: true }),
    skill: screen.getByLabelText("Skill", { exact: true }),
  };
}

function optionNames(select: HTMLElement) {
  return [...select.querySelectorAll("option")].map(
    (option) => option.textContent,
  );
}

function stats() {
  return screen.queryByRole("complementary", { name: "Skill stats" });
}

test("browses the tree through two labelled selects", () => {
  render(<Dropdowns tree={tree} />);

  const { category, skill } = selects();
  expect(optionNames(category)).toEqual([
    "Programming",
    "Frameworks",
    "Presentation",
  ]);
  expect(optionNames(skill)).toEqual(["Python", "Rust"]);
  expect(stats()).toHaveTextContent("Python");
});

test("reads out the skill a visitor picks", () => {
  render(<Dropdowns tree={tree} />);

  fireEvent.change(selects().skill, { target: { value: "rust" } });

  expect(stats()).toHaveTextContent("Rust");
});

test("moves the skill list and the stats with the chosen category", () => {
  render(<Dropdowns tree={tree} />);

  fireEvent.change(selects().category, { target: { value: "frameworks" } });

  expect(optionNames(selects().skill)).toEqual(["React"]);
  expect(stats()).toHaveTextContent("React");
});

test("shows no stats for a category the CV lists no skills under", () => {
  render(<Dropdowns tree={tree} />);

  fireEvent.change(selects().category, { target: { value: "presentation" } });

  expect(optionNames(selects().skill)).toEqual([]);
  expect(stats()).not.toBeInTheDocument();
});
