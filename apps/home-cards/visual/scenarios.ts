import type { VisualSuite } from "@site/visual-harness";
import { standardVisualScenarios } from "@site/visual-harness/scenarios";

const states: ReadonlyArray<string> = ["empty", "loading", "error"];
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
