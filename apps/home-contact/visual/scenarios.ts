import type { VisualSuite } from "../../../libs/visual-harness/src/index.ts";
import { standardVisualScenarios } from "../../../libs/visual-harness/src/scenarios.ts";

const states = ["empty", "loading", "error"] as const;
export const suite: VisualSuite = {
  project: "home-contact",
  hostPath: "",
  scenarios: standardVisualScenarios({
    states,
    query: (state) => `?state=${state}`,
    target: (page, state) =>
      state === "happy"
        ? page.getByRole("heading", { name: "Let’s build something useful." })
        : state === "loading"
          ? page
              .getByRole("status", {
                name: "Loading contact options",
                exact: true,
              })
              .first()
          : page.locator(".pane-state").first(),
  }),
};
