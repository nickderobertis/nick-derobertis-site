import type { VisualScenario, VisualSuite } from "@site/visual-harness";
import { standardVisualScenarios } from "@site/visual-harness/scenarios";

// `expanded` is the catalogue's one affordance: every course with a syllabus
// ships it collapsed, and a reader opens it in place. Nothing about the opened
// card — its overview, textbook, prerequisites, grading, and reading list — is
// in any shot of the closed one.
const states: ReadonlyArray<string> = ["empty", "loading", "error", "expanded"];
const scenarios = standardVisualScenarios({
  states,
  query: (state) => (state === "expanded" ? "" : `?courses-view=${state}`),
  target: (page, state) =>
    state === "happy"
      ? page.locator("body")
      : state === "expanded"
        ? page.getByRole("region", { name: "Course list" })
        : state === "loading"
          ? page
              .getByRole("status", { name: "Loading courses", exact: true })
              .first()
          : page.locator(".courses-state").first(),
  prepare: async (page, state) => {
    if (state === "expanded")
      await page.getByText("Explore Financial Modeling details").click();
  },
});

// The shared contract captures everything but `happy` at desktop only, and each
// of this route's other states re-lays-out below that width: an opened
// syllabus drops its summary and detail panes from two columns to one under
// 700px, the loading skeleton is padded from the viewport, and the empty and
// error panels take both their padding and their heading size from it. A
// visitor who opens any of those on a tablet or a phone therefore sees a layout
// no shot covers, so each state is captured at those widths too.
const narrowScenarios: VisualScenario[] = scenarios
  .filter((scenario) => scenario.state !== "happy")
  .map((scenario) => ({ ...scenario, viewports: ["tablet", "mobile"] }));

export const suite: VisualSuite = {
  project: "courses",
  hostPath: "courses",
  scenarios: [...scenarios, ...narrowScenarios],
};
