import type { VisualSuite } from "@site/visual-harness";
import { standardVisualScenarios } from "@site/visual-harness/scenarios";

const states: ReadonlyArray<string> = ["all", "empty", "loading", "error"];
export const suite: VisualSuite = {
  project: "awards",
  hostPath: "",
  scenarios: standardVisualScenarios({
    states,
    query: (state) =>
      state === "all" ? "?awards-view=all" : `?awards-scenario=${state}`,
    target: (page, state) =>
      state === "happy" || state === "all"
        ? page.getByRole("region", {
            name: state === "all" ? "Awards & honors" : "Selected awards",
          })
        : state === "loading"
          ? page
              .getByRole("status", { name: "Loading awards", exact: true })
              .first()
          : page.locator(".awards-state").first(),
  }),
};
