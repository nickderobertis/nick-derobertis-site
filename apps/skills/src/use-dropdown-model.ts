import type { SkillTree } from "@site/data-access-skills";
import { useState } from "react";

/**
 * The dropdown browser's selection. Choosing a category moves the skill
 * selection with it, because a skill from the previous category is not on the
 * list the visitor is now looking at; falling back to the category's first
 * skill is what keeps a selection showing rather than blanking the stats.
 */
export function useDropdownModel(tree: SkillTree) {
  const [categoryIdValue, setCategoryIdValue] = useState(tree.children[0]?.id);
  const category = tree.children.find((item) => item.id === categoryIdValue);
  const [skillIdValue, setSkillIdValue] = useState(category?.children[0]?.id);
  const skill =
    category?.children.find((item) => item.id === skillIdValue) ??
    category?.children[0];
  function selectCategory(id: string) {
    const next = tree.children.find((item) => item.id === id);
    setCategoryIdValue(next?.id);
    setSkillIdValue(next?.children[0]?.id);
  }
  return { category, selectCategory, setSkillIdValue, skill };
}
