import type { VisualScenario, VisualSuite } from "@site/visual-harness";
import { standardVisualScenarios } from "@site/visual-harness/scenarios";

const states: ReadonlyArray<string> = ["empty", "loading", "error"];
const scenarios = standardVisualScenarios({
  states,
  query: (state) => `?bio-view=${state}`,
  target: (page, state) =>
    state === "happy"
      ? page.locator("body")
      : state === "loading"
        ? page
            .getByRole("status", { name: "Loading biography", exact: true })
            .first()
        : page.locator(".bio-state").first(),
});

// The shared contract captures everything but `happy` at desktop only, and each
// of this route's other states re-lays-out below that width: the loading
// skeleton drops from its two-column cover-and-copy grid to one under 48rem and
// its cover grows to 16rem, while the empty and error panels are padded from
// the viewport rather than from their content and set their heading from a
// `5vw` clamp. A visitor who opens any of those on a tablet or a phone
// therefore sees a layout no shot covers, so each state is captured at those
// widths too.
const narrowScenarios: VisualScenario[] = scenarios
  .filter((scenario) => scenario.state !== "happy")
  .map((scenario) => ({ ...scenario, viewports: ["tablet", "mobile"] }));

export const suite: VisualSuite = {
  project: "bio",
  hostPath: "bio",
  scenarios: [...scenarios, ...narrowScenarios],
};
