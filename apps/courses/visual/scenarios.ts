import type { VisualSuite } from "@site/visual-harness";
import { standardVisualScenarios } from "@site/visual-harness/scenarios";

const states = ["empty", "loading", "error"] as const;
export const suite: VisualSuite = {
  project: "courses",
  hostPath: "courses",
  scenarios: standardVisualScenarios({
    states,
    query: (state) => `?courses-view=${state}`,
    target: (page, state) =>
      state === "happy"
        ? page.locator("body")
        : state === "loading"
          ? page
              .getByRole("status", { name: "Loading courses", exact: true })
              .first()
          : page.locator(".courses-state").first(),
  }),
};
