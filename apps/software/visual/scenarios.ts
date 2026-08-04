import type { VisualSuite } from "../../../libs/visual-harness/src/index.ts";
import { standardVisualScenarios } from "../../../libs/visual-harness/src/scenarios.ts";

const states = ["empty", "loading", "error"] as const;
export const suite: VisualSuite = {
  project: "software",
  hostPath: "software",
  scenarios: standardVisualScenarios({
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
  }),
};
