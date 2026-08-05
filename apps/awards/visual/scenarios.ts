import type { VisualScenario, VisualSuite } from "@site/visual-harness";
import { standardVisualScenarios } from "@site/visual-harness/scenarios";

const states: ReadonlyArray<string> = ["all", "empty", "loading", "error"];
const scenarios = standardVisualScenarios({
  states,
  query: (state) =>
    state === "all" ? "?awards-view=all" : `?awards-scenario=${state}`,
  target: (page, state) =>
    state === "happy" || state === "all"
      ? page.getByRole("region", {
          name: state === "all" ? "Awards & honors" : "Selected awards",
        })
      : state === "loading"
        ? page
            .getByRole("status", { name: "Loading awards", exact: true })
            .first()
        : page.locator(".awards-state").first(),
});

// The shared contract captures everything but `happy` at desktop only, and each
// of this pane's other states re-lays-out below that width: the complete set
// wraps its seven cards at both award-grid breakpoints, the loading skeleton
// drops from three columns to one under 48rem, and the empty and error panels
// are sized from the viewport rather than from their content. A visitor who
// opens any of those on a tablet or a phone therefore sees a layout no shot
// covers, so each state is captured at those widths too.
const narrowScenarios: VisualScenario[] = scenarios
  .filter((scenario) => scenario.state !== "happy")
  .map((scenario) => ({ ...scenario, viewports: ["tablet", "mobile"] }));

export const suite: VisualSuite = {
  project: "awards",
  hostPath: "",
  scenarios: [...scenarios, ...narrowScenarios],
};
