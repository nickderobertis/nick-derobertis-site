import type { VisualSuite } from "@site/visual-harness";
import { standardVisualScenarios } from "@site/visual-harness/scenarios";

const states = ["empty", "loading", "error", "employment-only"] as const;
export const suite: VisualSuite = {
  project: "timeline",
  hostPath: "",
  scenarios: standardVisualScenarios({
    states,
    query: (state) =>
      state === "employment-only" ? "" : `?timeline-state=${state}`,
    target: (page, state) =>
      ["happy", "employment-only"].includes(state)
        ? page.getByRole("region", { name: "Educated and Experienced" })
        : state === "loading"
          ? page
              .getByRole("status", { name: "Loading timeline", exact: true })
              .first()
          : page.locator(".timeline-state").first(),
    prepare: async (page, state) => {
      if (state === "employment-only")
        await page.getByRole("checkbox", { name: "Education" }).uncheck();
    },
  }),
};
