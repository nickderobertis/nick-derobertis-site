import type { VisualSuite } from "../../../libs/visual-harness/src/index.ts";
import { standardVisualScenarios } from "../../../libs/visual-harness/src/scenarios.ts";

const states = ["empty", "loading", "error"] as const;
export const suite: VisualSuite = {
  project: "home-cards",
  hostPath: "",
  scenarios: standardVisualScenarios({
    states,
    query: (state) => `?state=${state}`,
    target: (page, state) =>
      state === "happy"
        ? page.getByRole("region", { name: "Areas of work" })
        : state === "loading"
          ? page
              .getByRole("status", {
                name: "Loading areas of work",
                exact: true,
              })
              .first()
          : page.locator(".pane-state").first(),
  }),
};
