import type { VisualScenario, VisualSuite } from "@site/visual-harness";
import { standardVisualScenarios } from "@site/visual-harness/scenarios";

const states: ReadonlyArray<string> = ["empty", "loading", "error"];
const scenarios = standardVisualScenarios({
  states,
  query: (state) => `?software-view=${state}`,
  target: (page, state) =>
    state === "happy"
      ? page.locator("body")
      : state === "loading"
        ? page
            .getByRole("status", { name: "Loading software", exact: true })
            .first()
        : page.locator(".software-state").first(),
});

// The shared contract captures everything but `happy` at desktop only, and each
// of this route's other states re-lays-out below that width: the loading
// skeleton's card grid drops from three columns to one under 48rem, and the
// empty and error panels take their padding from a `6vw` clamp rather than from
// their content. A visitor who opens any of those on a tablet or a phone
// therefore sees a layout no shot covers, so each state is captured at those
// widths too.
const narrowScenarios: VisualScenario[] = scenarios
  .filter((scenario) => scenario.state !== "happy")
  .map((scenario) => ({ ...scenario, viewports: ["tablet", "mobile"] }));

export const suite: VisualSuite = {
  project: "software",
  hostPath: "software",
  scenarios: [...scenarios, ...narrowScenarios],
};
