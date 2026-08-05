import type { SkillTree } from "@site/data-access-skills";
import { useState } from "react";
import { Chart } from "./chart";
import { Dropdowns } from "./dropdowns";

/**
 * The settled pane. It introduces the tree, then hands the visitor whichever of
 * the two browsers they picked — both reach every skill, so the choice is only
 * ever about how they would rather get there.
 */
export function SkillsExperience({ tree }: { tree: SkillTree }) {
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
