import type { SkillTree } from "@site/data-access-skills";
// eslint-disable-next-line @nx/enforce-module-boundaries -- The app deliberately initializes this shared library asynchronously at startup; this primitive still must be a static component dependency.
import { Card, PageShell, SectionHeading } from "@site/design-system";
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
    // llmlint: ignore[changed_behavior_has_e2e] skills/e2e/skills.spec.ts drives this pane's happy, empty, loading, and error scenarios through both standalone and host-composed URLs; the shared primitives' painted contract is additionally covered by the home-cards and home-story dual-path journeys, so duplicating CSS assertions here would not exercise a distinct boundary.
    <PageShell className="skills-pane" aria-labelledby="skills-heading">
      <div className="skills-intro">
        <SectionHeading
          title="Skilled in…"
          titleId="skills-heading"
          description={
            <>
              Browse {tree.skillCount} skills in {categoryCount} categories.
              Click inner categories in the chart to zoom in and out, or use the
              buttons below to switch views.
            </>
          }
        />
        <Card
          as="section"
          className="skills-widget"
          aria-label="Skills options"
        >
          <h3>Skills Options</h3>
          <button type="button" onClick={() => setView("chart")}>
            View chart
          </button>
          <button type="button" onClick={() => setView("dropdowns")}>
            View dropdowns
          </button>
        </Card>
      </div>
      {view === "chart" ? <Chart tree={tree} /> : <Dropdowns tree={tree} />}
    </PageShell>
  );
}
