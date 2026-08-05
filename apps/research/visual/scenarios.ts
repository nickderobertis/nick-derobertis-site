import type { VisualScenario, VisualSuite } from "@site/visual-harness";
import { standardVisualScenarios } from "@site/visual-harness/scenarios";

const states: ReadonlyArray<string> = ["empty", "loading", "error"];
const scenarios = standardVisualScenarios({
  states,
  query: (state) => `?research-scenario=${state}`,
  target: (page, state) =>
    state === "happy"
      ? page.locator(".research-page")
      : state === "loading"
        ? page
            .getByRole("status", { name: "Loading research", exact: true })
            .first()
        : page.locator(".research-state").first(),
});

// The shared contract captures everything but `happy` at desktop only, and each
// of this route's other states re-lays-out below that width: the empty and
// error panels are sized from the viewport — 45vh tall, with a heading set from
// a `5vw` clamp — and the loading skeleton takes its padding from a `4vw`
// clamp. A visitor who opens any of those on a tablet or a phone therefore sees
// a layout no shot covers, so each state is captured at those widths too.
const narrowScenarios: VisualScenario[] = scenarios
  .filter((scenario) => scenario.state !== "happy")
  .map((scenario) => ({ ...scenario, viewports: ["tablet", "mobile"] }));

export const suite: VisualSuite = {
  project: "research",
  hostPath: "research",
  scenarios: [...scenarios, ...narrowScenarios],
};
