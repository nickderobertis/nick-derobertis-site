import type { SkillTree, SkillTreeNode } from "@site/data-access-skills";
import { act, renderHook } from "@testing-library/react";
import { expect, test } from "vitest";
import { useDropdownModel } from "./use-dropdown-model";

function node(id: string, children: SkillTreeNode[] = []): SkillTreeNode {
  return {
    children,
    experience: "Proficient",
    firstUsed: null,
    hours: null,
    id,
    level: 3,
    title: id,
  };
}

const python = node("python");
const react = node("react");
const programming = node("programming", [python, node("rust")]);
const frameworks = node("frameworks", [react]);
const presentation = node("presentation");
const tree: SkillTree = {
  children: [programming, frameworks, presentation],
  skillCount: 3,
  title: "Skills",
};

test("opens on the first category and the first skill under it", () => {
  const { result } = renderHook(() => useDropdownModel(tree));

  expect(result.current.category).toBe(programming);
  expect(result.current.skill).toBe(python);
});

test("moves the skill selection along with the category", () => {
  const { result } = renderHook(() => useDropdownModel(tree));

  act(() => result.current.selectCategory("frameworks"));

  // Leaving Python selected would leave the stats describing a skill that is no
  // longer on the list the visitor is looking at.
  expect(result.current.category).toBe(frameworks);
  expect(result.current.skill).toBe(react);
});

test("falls back to the category's first skill rather than showing none", () => {
  const { result } = renderHook(() => useDropdownModel(tree));
  act(() => result.current.setSkillIdValue("react"));

  expect(result.current.skill).toBe(python);
});

test("leaves nothing selected for a category the CV lists no skills under", () => {
  const { result } = renderHook(() => useDropdownModel(tree));

  act(() => result.current.selectCategory("presentation"));

  expect(result.current.category).toBe(presentation);
  expect(result.current.skill).toBeUndefined();
});

test("keeps the browser on its category when handed an id no category owns", () => {
  const { result } = renderHook(() => useDropdownModel(tree));

  act(() => result.current.selectCategory("not-a-category"));

  expect(result.current.category).toBeUndefined();
  expect(result.current.skill).toBeUndefined();
});

test("opens on nothing at all when the tree carries no categories", () => {
  const { result } = renderHook(() =>
    useDropdownModel({ children: [], skillCount: 0, title: "Skills" }),
  );

  expect(result.current.category).toBeUndefined();
  expect(result.current.skill).toBeUndefined();
});
