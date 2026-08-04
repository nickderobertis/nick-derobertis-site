import type { VisualSuite } from "../../../libs/visual-harness/src/index.ts";
import { standardVisualScenarios } from "../../../libs/visual-harness/src/scenarios.ts";

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
