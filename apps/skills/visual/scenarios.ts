import type { VisualSuite } from "@site/visual-harness";
import { standardVisualScenarios } from "@site/visual-harness/scenarios";

const states = ["empty", "loading", "error", "expanded"] as const;
export const suite: VisualSuite = {
  project: "skills",
  hostPath: "",
  scenarios: standardVisualScenarios({
    states,
    query: (state) => (state === "expanded" ? "" : `?skills-state=${state}`),
    target: (page, state) =>
      ["happy", "expanded"].includes(state)
        ? page.getByRole("region", { name: "Skilled in…" })
        : state === "loading"
          ? page
              .getByRole("status", { name: "Loading skills", exact: true })
              .first()
          : page.locator(".skills-state").first(),
    prepare: async (page, state) => {
      if (state === "expanded")
        await page
          .getByRole("button", { name: "Explore Programming category" })
          .click();
    },
  }),
};
