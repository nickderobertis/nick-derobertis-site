import type { VisualSuite } from "@site/visual-harness";
import { standardVisualScenarios } from "@site/visual-harness/scenarios";

const states: ReadonlyArray<string> = ["empty", "loading", "error"];
export const suite: VisualSuite = {
  project: "bio",
  hostPath: "bio",
  scenarios: standardVisualScenarios({
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
  }),
};
