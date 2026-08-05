import type { SkillTree, SkillTreeNode } from "@site/data-access-skills";
import { useState } from "react";

/**
 * The sunburst's drill-down. `active` is the category a visitor zoomed into, so
 * the chart draws that one category's skills instead of all seven; `focused` is
 * whichever sector or control the pointer or the focus ring is on. Sizing every
 * category by at least one child keeps an empty category visible rather than
 * collapsing it to a zero-width sliver.
 */
export function useChartModel(tree: SkillTree) {
  const [active, setActive] = useState<SkillTreeNode | null>(null);
  const [focused, setFocused] = useState<SkillTreeNode | null>(null);
  const categories = active ? [active] : tree.children;
  const total = categories.reduce(
    (count, category) => count + Math.max(1, category.children.length),
    0,
  );
  return { active, categories, focused, setActive, setFocused, total };
}
