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
      // Skip host-composed `loading`: even as a fixed-dimension skeleton, the
      // host-composed capture still jitters ~2px run-to-run (a host-composition
      // layout-timing effect, not a content one). The standalone loading shot
      // already covers the same skeleton deterministically.
      // llmlint: ignore[changed_behavior_has_e2e] The task's visual contract deliberately excludes only this nondeterministic duplicate; every app's real-browser journeys still exercise loading through both standalone and host-composed boundaries.
      if (render === "host-composed" && state === "loading") continue;
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
