import type { VisualSuite } from "../../../libs/visual-harness/src/index.ts";
import { standardVisualScenarios } from "../../../libs/visual-harness/src/scenarios.ts";

const states = ["empty", "loading", "error"] as const;
export const suite: VisualSuite = {
  project: "home",
  hostPath: "",
  scenarios: standardVisualScenarios({
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
  }),
};
