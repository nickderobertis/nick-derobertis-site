import type { VisualScenario, VisualSuite } from "@site/visual-harness";
import { standardVisualScenarios } from "@site/visual-harness/scenarios";

const states: ReadonlyArray<string> = ["empty", "loading", "error"];
const scenarios = standardVisualScenarios({
  states,
  query: (state) => `?state=${state}`,
  target: (page, state) =>
    state === "happy"
      ? page.getByRole("region", { name: "Featured work" })
      : state === "loading"
        ? page
            .getByRole("status", {
              name: "Loading featured work",
              exact: true,
            })
            .first()
        : page.locator(".pane-state").first(),
});

// The shared contract captures everything but `happy` at desktop only, and each
// of this pane's other states is sized from the viewport rather than from its
// content: the loading skeleton's hero band and dots span the full width, and
// the empty and error panels take the narrower of 1100px and the viewport. A
// visitor who previews any of those on a tablet or a phone therefore sees a
// layout no shot covers, so each state is captured at those widths too.
const narrowScenarios: VisualScenario[] = scenarios
  .filter((scenario) => scenario.state !== "happy")
  .map((scenario) => ({ ...scenario, viewports: ["tablet", "mobile"] }));

export const suite: VisualSuite = {
  project: "home-carousel",
  hostPath: "",
  scenarios: [...scenarios, ...narrowScenarios],
};
