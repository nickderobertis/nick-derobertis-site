import type { SkillTree } from "@site/data-access-skills";
import { ChartControls } from "./chart-controls";
import { arc } from "./chart-geometry";
import { SkillDetails } from "./skill-details";
import { useChartModel } from "./use-chart-model";

const COLORS: readonly string[] = [
  "#267bb5",
  "#ff7f0e",
  "#2ca02c",
  "#d62728",
  "#9467bd",
  "#8c564b",
  "#df65b0",
];

/**
 * The sunburst. The inner ring is one sector per category and the outer ring is
 * its skills; drilling into a category redraws both rings from that category
 * alone, and every sector keeps the colour its category has at the top level so
 * a visitor who zoomed in still recognises where they are.
 */
export function Chart({ tree }: { tree: SkillTree }) {
  const { active, categories, focused, setActive, setFocused, total } =
    useChartModel(tree);
  let cursor = 0;
  return (
    <div className="chart-wrap">
      <svg
        className="skills-chart"
        viewBox="0 0 500 500"
        role="img"
        aria-label="Skills sunburst chart"
      >
        {categories.map((category) => {
          const colorIndex = tree.children.findIndex(
            (item) => item.id === category.id,
          );
          const span = (Math.max(1, category.children.length) / total) * 359.9;
          const start = cursor;
          const end = cursor + span;
          cursor = end;
          const children = category.children.length
            ? category.children
            : [category];
          return (
            <g key={category.id}>
              <path
                d={arc(0, active ? 145 : 125, start, end)}
                fill={COLORS[colorIndex]}
                className="skill-sector category-sector"
                aria-label={`${category.title} category, ${category.children.length} skills`}
                onPointerEnter={() => setFocused(category)}
                onPointerLeave={() => setFocused(null)}
              />
              {children.map((skill, index) => {
                const childStart = start + (span * index) / children.length;
                const childEnd = start + (span * (index + 1)) / children.length;
                return (
                  <path
                    key={skill.id}
                    d={arc(active ? 145 : 125, 245, childStart, childEnd)}
                    fill={COLORS[colorIndex]}
                    opacity="0.75"
                    className="skill-sector"
                    aria-label={`${skill.title}, level ${skill.level}`}
                    onPointerEnter={() => setFocused(skill)}
                    onPointerLeave={() => setFocused(null)}
                  />
                );
              })}
            </g>
          );
        })}
        {active ? (
          <text x="250" y="255" textAnchor="middle" className="chart-label">
            {active.title}
          </text>
        ) : null}
      </svg>
      <ChartControls
        active={active}
        categories={categories}
        onSelect={(category) => setActive(active ? null : category)}
        onSpotlight={setFocused}
      />
      {focused ? <SkillDetails skill={focused} /> : null}
      <p className="chart-instruction">
        {active
          ? `${active.title} expanded. Activate the center category to zoom out.`
          : "Activate an inner category to drill down."}
      </p>
    </div>
  );
}
