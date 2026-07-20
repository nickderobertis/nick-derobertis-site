import { useState } from "react";
import type { SkillNode } from "./skill-tree";

const colors = [
  "#287bb5",
  "#ff8313",
  "#2aa62b",
  "#df272d",
  "#9468c4",
  "#805142",
  "#dc58b3",
];
const TAU = Math.PI * 2;

function useSunburstFocus(tree: SkillNode[]) {
  const [focusId, setFocusId] = useState<string | null>(null);
  const focused = tree.find((node) => node.skill.id === focusId);
  return { focused, setFocusId, visible: focused ? [focused] : tree };
}

function point(radius: number, angle: number): [number, number] {
  return [
    160 + radius * Math.cos(angle - Math.PI / 2),
    160 + radius * Math.sin(angle - Math.PI / 2),
  ];
}
function arcPath(
  inner: number,
  outer: number,
  start: number,
  end: number,
): string {
  const [a, b, c, d] = [
    point(outer, start),
    point(outer, end),
    point(inner, end),
    point(inner, start),
  ];
  const large = end - start > Math.PI ? 1 : 0;
  return `M ${a[0]} ${a[1]} A ${outer} ${outer} 0 ${large} 1 ${b[0]} ${b[1]} L ${c[0]} ${c[1]} A ${inner} ${inner} 0 ${large} 0 ${d[0]} ${d[1]} Z`;
}

export function Sunburst({
  tree,
  onSelect,
}: {
  tree: SkillNode[];
  onSelect: (node: SkillNode) => void;
}) {
  const { focused, setFocusId, visible } = useSunburstFocus(tree);
  const total = visible.reduce(
    (sum, node) => sum + Math.max(node.children.length, 1),
    0,
  );
  let cursor = 0;
  return (
    <div className="sunburst-wrap">
      {focused && (
        <button
          className="zoom-out"
          type="button"
          onClick={() => setFocusId(null)}
        >
          Show all categories
        </button>
      )}
      <div role="tree" aria-label="Interactive skills sunburst">
        <svg className="sunburst" viewBox="0 0 320 320">
          <title>Skills grouped into interactive category rings</title>
          {visible.map((node) => {
            const portion = Math.max(node.children.length, 1) / total;
            const start = cursor * TAU;
            const end = (cursor + portion) * TAU;
            cursor += portion;
            const originalIndex = tree.indexOf(node);
            const color = colors[originalIndex % colors.length];
            return (
              <g
                key={node.skill.id}
                role="treeitem"
                aria-label={`${node.skill.name}, ${node.children.length} skills`}
                tabIndex={0}
                onClick={() => {
                  setFocusId(focused ? null : node.skill.id);
                  onSelect(node);
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  setFocusId(focused ? null : node.skill.id);
                  onSelect(node);
                }}
              >
                <path
                  className="category-segment"
                  d={arcPath(0, focused ? 88 : 78, start, end)}
                  fill={color}
                >
                  <title>
                    {node.skill.name}: level {node.skill.level}
                  </title>
                </path>
                {node.children.map((child, index) => {
                  const childStart =
                    start + ((end - start) * index) / node.children.length;
                  const childEnd =
                    start +
                    ((end - start) * (index + 1)) / node.children.length;
                  return (
                    <g
                      key={child.skill.id}
                      role="treeitem"
                      tabIndex={0}
                      aria-label={child.skill.name}
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelect(child);
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") return;
                        event.preventDefault();
                        onSelect(child);
                      }}
                    >
                      <path
                        className="skill-segment"
                        d={arcPath(
                          focused ? 88 : 78,
                          150,
                          childStart,
                          childEnd,
                        )}
                        fill={color}
                      >
                        <title>
                          {child.skill.name}: level {child.skill.level}
                        </title>
                      </path>
                    </g>
                  );
                })}
              </g>
            );
          })}
          <text x="160" y="156" textAnchor="middle" className="chart-title">
            {focused?.skill.name ?? "Skills"}
          </text>
          <text x="160" y="174" textAnchor="middle" className="chart-subtitle">
            {focused
              ? `${focused.children.length} skills`
              : `${tree.length} categories`}
          </text>
        </svg>
      </div>
    </div>
  );
}
