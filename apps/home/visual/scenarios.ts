import type { VisualScenario, VisualSuite } from "@site/visual-harness";
import { standardVisualScenarios } from "@site/visual-harness/scenarios";

const states: ReadonlyArray<string> = ["empty", "loading", "error"];
const scenarios = standardVisualScenarios({
  states,
  query: (state) => `?state=${state}`,
  target: (page, state) =>
    state === "happy"
      ? page.locator("body")
      : state === "loading"
        ? page.getByRole("status").first()
        : page.locator(".pane-state").first(),
  prepare: async (page) => {
    await page
      .getByText("Loading HOME page…")
      .waitFor({ state: "hidden", timeout: 30_000 });
  },
});

// The shared contract captures everything but `happy` at desktop only, and each
// of the composed page's other states re-lays-out below that width: the pane
// skeletons drop from three columns to one under 48rem, and the empty and error
// panels are sized from the viewport rather than from their content. A visitor
// who previews any of those on a tablet or a phone therefore sees a layout no
// shot covers, so each state is captured at those widths too.
const narrowScenarios: VisualScenario[] = scenarios
  .filter((scenario) => scenario.state !== "happy")
  .map((scenario) => ({ ...scenario, viewports: ["tablet", "mobile"] }));

export const suite: VisualSuite = {
  project: "home",
  hostPath: "",
  scenarios: [...scenarios, ...narrowScenarios],
};
