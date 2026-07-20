import {
  buildSkillTree,
  cvDataClient,
  type SkillTree,
  type SkillTreeNode,
} from "@site/data-access";
import { useId, useState } from "react";
import "./skills.css";

const COLORS = [
  "#267bb5",
  "#ff7f0e",
  "#2ca02c",
  "#d62728",
  "#9467bd",
  "#8c564b",
  "#df65b0",
] as const;
type SkillsState = "empty" | "error" | "loading" | "ready";

function previewState(): SkillsState {
  if (typeof window === "undefined") return "ready";
  const value = new URLSearchParams(window.location.search).get("skills-state");
  return value === "empty" || value === "error" || value === "loading"
    ? value
    : "ready";
}

function point(radius: number, angle: number) {
  const radians = ((angle - 90) * Math.PI) / 180;
  return [250 + radius * Math.cos(radians), 250 + radius * Math.sin(radians)];
}

function arc(inner: number, outer: number, start: number, end: number) {
  const [a, b] = point(outer, start);
  const [c, d] = point(outer, end);
  const [e, f] = point(inner, end);
  const [g, h] = point(inner, start);
  const large = end - start > 180 ? 1 : 0;
  return `M ${a} ${b} A ${outer} ${outer} 0 ${large} 1 ${c} ${d} L ${e} ${f} A ${inner} ${inner} 0 ${large} 0 ${g} ${h} Z`;
}

function SkillDetails({ skill }: { skill: SkillTreeNode }) {
  const years = skill.firstUsed
    ? Math.max(
        0,
        new Date().getUTCFullYear() - Number(skill.firstUsed.slice(0, 4)),
      )
    : null;
  return (
    <aside
      className="skill-details"
      aria-live="polite"
      aria-label="Skill stats"
    >
      <strong>{skill.title}</strong>
      <span>{skill.experience}</span>
      <span>
        {skill.hours === null
          ? "Hours not recorded"
          : `Est. Hours: ${Math.round(skill.hours).toLocaleString("en-US")}`}
      </span>
      <span>
        {years === null
          ? "First use not recorded"
          : `First used: ${years} years ago`}
      </span>
    </aside>
  );
}

function useChartModel(tree: SkillTree) {
  const [active, setActive] = useState<SkillTreeNode | null>(null);
  const [focused, setFocused] = useState<SkillTreeNode | null>(null);
  const categories = active ? [active] : tree.children;
  const total = categories.reduce(
    (count, category) => count + Math.max(1, category.children.length),
    0,
  );
  return { active, categories, focused, setActive, setFocused, total };
}

function Chart({ tree }: { tree: SkillTree }) {
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
                d={arc(active ? 0 : 0, active ? 145 : 125, start, end)}
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
      <div className="chart-keyboard-controls">
        {categories.map((category) => (
          <button
            type="button"
            key={category.id}
            onClick={() => setActive(active ? null : category)}
            onFocus={() => setFocused(category)}
            onBlur={() => setFocused(null)}
            onPointerEnter={() => setFocused(category)}
            onPointerLeave={() => setFocused(null)}
          >
            {active
              ? `Zoom out from ${category.title}`
              : `Explore ${category.title} category`}
          </button>
        ))}
      </div>
      {focused ? <SkillDetails skill={focused} /> : null}
      <p className="chart-instruction">
        {active
          ? `${active.title} expanded. Activate the center category to zoom out.`
          : "Activate an inner category to drill down."}
      </p>
    </div>
  );
}

function useDropdownModel(tree: SkillTree) {
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

function Dropdowns({ tree }: { tree: SkillTree }) {
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

function SkillsExperience({ tree }: { tree: SkillTree }) {
  const [view, setView] = useState<"chart" | "dropdowns">("chart");
  const categoryCount = tree.children.length;
  return (
    <section className="skills-pane" aria-labelledby="skills-heading">
      <div className="skills-intro">
        <h2 id="skills-heading">Skilled in…</h2>
        <p>
          Browse {tree.skillCount} skills in {categoryCount} categories. Click
          inner categories in the chart to zoom in and out, or use the buttons
          below to switch views.
        </p>
        <section className="skills-widget" aria-label="Skills options">
          <h3>Skills Options</h3>
          <button type="button" onClick={() => setView("chart")}>
            View chart
          </button>
          <button type="button" onClick={() => setView("dropdowns")}>
            View dropdowns
          </button>
        </section>
      </div>
      {view === "chart" ? <Chart tree={tree} /> : <Dropdowns tree={tree} />}
    </section>
  );
}

export default function SkillsPage() {
  const state = previewState();
  if (state === "loading")
    return <output className="skills-state">Loading skills…</output>;
  if (state === "error")
    return (
      <section className="skills-state" role="alert">
        <h2>Skills unavailable</h2>
        <p>Skills data could not be loaded. Please try again later.</p>
      </section>
    );
  const tree = buildSkillTree(
    state === "empty" ? [] : cvDataClient.domain("skills"),
  );
  if (tree.skillCount === 0)
    return (
      <p className="skills-state" role="status">
        No skills are available.
      </p>
    );
  return <SkillsExperience tree={tree} />;
}
