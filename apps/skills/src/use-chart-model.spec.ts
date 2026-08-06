import type { SkillTree, SkillTreeNode } from "@site/data-access-skills";
import { act, renderHook } from "@testing-library/react";
import { expect, test } from "vitest";
import { useChartModel } from "./use-chart-model";

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

const programming = node("programming", [node("python"), node("rust")]);
const presentation = node("presentation");
const tree: SkillTree = {
  children: [programming, presentation],
  skillCount: 2,
  title: "Skills",
};

test("opens on the whole tree with nothing spotlighted", () => {
  const { result } = renderHook(() => useChartModel(tree));

  expect(result.current.active).toBeNull();
  expect(result.current.focused).toBeNull();
  expect(result.current.categories).toEqual(tree.children);
});

test("keeps a category with no skills wide enough to be seen", () => {
  const { result } = renderHook(() => useChartModel(tree));

  // Programming's two skills plus the single share an empty category is given,
  // so `presentation` is drawn as a sliver rather than as nothing at all.
  expect(result.current.total).toBe(3);
});

test("narrows the chart to the category a visitor drilled into", () => {
  const { result } = renderHook(() => useChartModel(tree));

  act(() => result.current.setActive(programming));

  expect(result.current.categories).toEqual([programming]);
  expect(result.current.total).toBe(2);
});

test("spotlights whichever skill the visitor is on, and lets it go again", () => {
  const { result } = renderHook(() => useChartModel(tree));

  act(() => result.current.setFocused(programming));
  expect(result.current.focused).toBe(programming);

  act(() => result.current.setFocused(null));
  expect(result.current.focused).toBeNull();
});
