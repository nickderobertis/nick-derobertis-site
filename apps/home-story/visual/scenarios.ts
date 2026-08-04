import type { VisualSuite } from "@site/visual-harness";
import { standardVisualScenarios } from "@site/visual-harness/scenarios";

const states = ["empty", "loading", "error"] as const;
export const suite: VisualSuite = {
  project: "home-story",
  hostPath: "",
  scenarios: standardVisualScenarios({
    states,
    query: (state) => `?state=${state}`,
    target: (page, state) =>
      state === "happy"
        ? page.getByRole("heading", { name: "Who am I?" })
        : state === "loading"
          ? page
              .getByRole("status", { name: "Loading story", exact: true })
              .first()
          : page.locator(".pane-state").first(),
  }),
};
