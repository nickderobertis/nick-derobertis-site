import type { VisualSuite } from "../../../libs/visual-harness/src/index.ts";
import { standardVisualScenarios } from "../../../libs/visual-harness/src/scenarios.ts";

const states = ["empty", "loading", "error"] as const;
export const suite: VisualSuite = {
  project: "research",
  hostPath: "research",
  scenarios: standardVisualScenarios({
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
  }),
};
