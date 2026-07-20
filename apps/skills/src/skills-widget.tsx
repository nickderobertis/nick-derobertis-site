import { useState } from "react";
import { formatHours, type SkillNode } from "./skill-tree";
import { Sunburst } from "./sunburst";

function useSkillSelection(tree: SkillNode[]) {
  const [selected, setSelected] = useState<SkillNode | undefined>(
    () => tree[0],
  );
  const first = tree[0];
  const selectedCategory =
    first && selected
      ? (tree.find((node) => node.skill.id === selected.skill.id) ??
        tree.find((node) =>
          node.children.some((child) => child.skill.id === selected.skill.id),
        ) ??
        first)
      : undefined;
  return { first, selected, selectedCategory, setSelected };
}

export function SkillsWidget({
  tree,
  count,
}: {
  tree: SkillNode[];
  count: number;
}) {
  const [mode, setMode] = useState<"chart" | "dropdowns">("chart");
  const { first, selected, selectedCategory, setSelected } =
    useSkillSelection(tree);
  if (!first || !selected || !selectedCategory) return null;
  return (
    <section className="skills-pane" aria-labelledby="skills-title">
      <div className="skills-intro">
        <p className="eyebrow">Expertise</p>
        <h1 id="skills-title">Skilled in…</h1>
        <p>
          Browse {count} skills in {tree.length} categories. Click inner
          categories in the chart to zoom in and out, or switch to a dropdown
          view.
        </p>
        <fieldset className="skills-options">
          <legend>Skills Options</legend>
          <button
            type="button"
            aria-pressed={mode === "chart"}
            onClick={() => setMode("chart")}
          >
            View chart
          </button>
          <button
            type="button"
            aria-pressed={mode === "dropdowns"}
            onClick={() => setMode("dropdowns")}
          >
            View dropdowns
          </button>
        </fieldset>
        <dl className="skill-stats" aria-label="Selected skill statistics">
          <div>
            <dt>Selected</dt>
            <dd>{selected.skill.name}</dd>
          </div>
          <div>
            <dt>Level</dt>
            <dd>{selected.skill.level} / 5</dd>
          </div>
          <div>
            <dt>Experience</dt>
            <dd>{formatHours(selected.skill.experience?.total_hours)} hours</dd>
          </div>
        </dl>
      </div>
      <div className="skills-visual">
        {mode === "chart" ? (
          <Sunburst tree={tree} onSelect={setSelected} />
        ) : (
          <form className="skill-picker">
            <label htmlFor="skill-category">Category</label>
            <select
              id="skill-category"
              value={selectedCategory.skill.id}
              onChange={(event) =>
                setSelected(
                  tree.find((node) => node.skill.id === event.target.value) ??
                    first,
                )
              }
            >
              {tree.map((node) => (
                <option key={node.skill.id} value={node.skill.id}>
                  {node.skill.name}
                </option>
              ))}
            </select>
            <label htmlFor="skill-name">Skill</label>
            <select
              id="skill-name"
              value={selected.skill.id}
              onChange={(event) =>
                setSelected(
                  selectedCategory.children.find(
                    (node) => node.skill.id === event.target.value,
                  ) ?? selectedCategory,
                )
              }
            >
              <option value={selectedCategory.skill.id}>
                {selectedCategory.skill.name}
              </option>
              {selectedCategory.children.map((node) => (
                <option key={node.skill.id} value={node.skill.id}>
                  {node.skill.name}
                </option>
              ))}
            </select>
          </form>
        )}
      </div>
    </section>
  );
}
