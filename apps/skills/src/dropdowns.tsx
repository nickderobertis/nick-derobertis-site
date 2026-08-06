import type { SkillTree } from "@site/data-access-skills";
import { useId } from "react";
import { SkillDetails } from "./skill-details";
import { useDropdownModel } from "./use-dropdown-model";

/**
 * The chart's alternative: two labelled selects that reach the same skill stats
 * without a pointer or an SVG, for a visitor who would rather read the tree
 * than aim at it.
 */
export function Dropdowns({ tree }: { tree: SkillTree }) {
  const categoryId = useId();
  const skillId = useId();
  const { category, selectCategory, setSkillIdValue, skill } =
    useDropdownModel(tree);
  return (
    <section className="skills-dropdowns" aria-label="Skills dropdown browser">
      <label htmlFor={categoryId}>Category</label>
      <select
        id={categoryId}
        value={category?.id}
        onChange={(event) => selectCategory(event.currentTarget.value)}
      >
        {tree.children.map((item) => (
          <option key={item.id} value={item.id}>
            {item.title}
          </option>
        ))}
      </select>
      <label htmlFor={skillId}>Skill</label>
      <select
        id={skillId}
        value={skill?.id}
        onChange={(event) => setSkillIdValue(event.currentTarget.value)}
      >
        {category?.children.map((item) => (
          <option key={item.id} value={item.id}>
            {item.title}
          </option>
        ))}
      </select>
      {skill ? <SkillDetails skill={skill} /> : null}
    </section>
  );
}
