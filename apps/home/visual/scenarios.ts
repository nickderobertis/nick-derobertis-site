import type { VisualSuite } from "@site/visual-harness";
import { standardVisualScenarios } from "@site/visual-harness/scenarios";

const states: ReadonlyArray<string> = ["empty", "loading", "error"];
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
