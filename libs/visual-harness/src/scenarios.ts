import type { Locator, Page } from "@playwright/test";
import type { VisualScenario, VisualViewport } from "./index.ts";

const allViewports: ReadonlyArray<VisualViewport> = [
  "desktop",
  "tablet",
  "mobile",
];

export interface StandardScenarioOptions {
  states: readonly string[];
  query: (state: string) => string;
  target: (page: Page, state: string) => Locator;
  prepare?: (page: Page, state: string) => Promise<void>;
}

export function standardVisualScenarios({
  states,
  query,
  target,
  prepare,
}: StandardScenarioOptions): VisualScenario[] {
  const scenarios: VisualScenario[] = ["standalone", "host-composed"].map(
    (render) => ({
      render: render as VisualScenario["render"],
      state: "happy",
      viewports: allViewports,
      target: (page) => target(page, "happy"),
      ...(prepare ? { prepare: (page) => prepare(page, "happy") } : {}),
    }),
  );
  for (const state of states) {
    for (const render of ["standalone", "host-composed"] as const) {
      scenarios.push({
        render,
        state,
        viewports: ["desktop"],
        query: query(state),
        stallTimers: state === "loading",
        freezeAnimations: ["empty", "loading", "error"].includes(state),
        allowPageErrors: state === "error",
        target: (page) => target(page, state),
        ...(prepare ? { prepare: (page) => prepare(page, state) } : {}),
      });
    }
  }
  return scenarios;
}
