import type { VisualScenario, VisualSuite } from "@site/visual-harness";
import { standardVisualScenarios } from "@site/visual-harness/scenarios";

// `expanded`, `dropdowns`, and `stats` are reached by using the settled pane
// rather than by steering it with a query, so they carry no `skills-state`.
const INTERACTED: ReadonlyArray<string> = ["expanded", "dropdowns", "stats"];
const states: ReadonlyArray<string> = [
  "empty",
  "loading",
  "error",
  ...INTERACTED,
];
const scenarios = standardVisualScenarios({
  states,
  query: (state) =>
    INTERACTED.includes(state) ? "" : `?skills-state=${state}`,
  target: (page, state) =>
    state === "happy" || INTERACTED.includes(state)
      ? page.getByRole("region", { name: "Skilled in…" })
      : state === "loading"
        ? page
            .getByRole("status", { name: "Loading skills", exact: true })
            .first()
        : page.locator(".skills-state").first(),
  prepare: async (page, state) => {
    if (state === "expanded")
      await page
        .getByRole("button", { name: "Explore Programming category" })
        .click();
    // The dropdown browser is the pane's other half: a visitor who switches
    // views gets a layout the chart shots never show.
    if (state === "dropdowns")
      await page.getByRole("button", { name: "View dropdowns" }).click();
    // Skill stats are drawn over the chart, and the only way to see them in a
    // deterministic shot is the keyboard route a visitor already has.
    if (state === "stats")
      await page
        .getByRole("button", { name: "Explore Programming category" })
        .focus();
  },
});

// The shared contract captures everything but `happy` at desktop only, and
// skills.css re-lays-out the whole pane below 700px: the intro stacks above the
// chart, the chart is resized from the viewport, the options widget is centred
// at a fixed width, and the stats panel moves inside the chart. A visitor who
// opens any state on a phone therefore sees a layout no desktop shot covers.
const narrowScenarios: VisualScenario[] = scenarios
  .filter((scenario) => scenario.state !== "happy")
  .map((scenario) => ({ ...scenario, viewports: ["mobile"] }));

export const suite: VisualSuite = {
  project: "skills",
  hostPath: "",
  scenarios: [...scenarios, ...narrowScenarios],
};
