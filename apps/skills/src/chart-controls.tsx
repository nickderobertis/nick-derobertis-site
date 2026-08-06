import type { SkillTreeNode } from "@site/data-access-skills";

/**
 * The chart's keyboard path. Every sector is drawn in SVG a pointer can hover
 * but a keyboard cannot reach, so each category also gets a button that both
 * drills the chart in and out and spotlights the same skill stats a hover does.
 */
export function ChartControls({
  active,
  categories,
  onSelect,
  onSpotlight,
}: {
  active: SkillTreeNode | null;
  categories: readonly SkillTreeNode[];
  onSelect: (category: SkillTreeNode) => void;
  onSpotlight: (skill: SkillTreeNode | null) => void;
}) {
  return (
    <div className="chart-keyboard-controls">
      {categories.map((category) => (
        <button
          type="button"
          key={category.id}
          onClick={() => onSelect(category)}
          onFocus={() => onSpotlight(category)}
          onBlur={() => onSpotlight(null)}
          onPointerEnter={() => onSpotlight(category)}
          onPointerLeave={() => onSpotlight(null)}
        >
          {active
            ? `Zoom out from ${category.title}`
            : `Explore ${category.title} category`}
        </button>
      ))}
    </div>
  );
}
