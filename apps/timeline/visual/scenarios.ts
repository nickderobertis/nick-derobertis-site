import type { VisualScenario, VisualSuite } from "@site/visual-harness";
import { standardVisualScenarios } from "@site/visual-harness/scenarios";

// The three filter combinations below are reached by using the settled pane
// rather than by steering it with a query, so they carry no `timeline-state`.
const FILTERED: ReadonlyArray<string> = [
  "employment-only",
  "education-only",
  "no-results",
];
const states: ReadonlyArray<string> = [
  "empty",
  "loading",
  "error",
  ...FILTERED,
];
const scenarios = standardVisualScenarios({
  states,
  query: (state) =>
    FILTERED.includes(state) ? "" : `?timeline-state=${state}`,
  target: (page, state) =>
    state === "happy" || FILTERED.includes(state)
      ? page.getByRole("region", { name: "Educated and Experienced" })
      : state === "loading"
        ? page
            .getByRole("status", { name: "Loading timeline", exact: true })
            .first()
        : page.locator(".timeline-state").first(),
  prepare: async (page, state) => {
    if (state === "employment-only" || state === "no-results")
      await page.getByRole("checkbox", { name: "Education" }).uncheck();
    // The education half alone is four rows against the same axis, a shape no
    // other shot shows.
    if (state === "education-only" || state === "no-results")
      await page.getByRole("checkbox", { name: "Employment" }).uncheck();
    // Unchecking leaves the pointer resting on the last filter it clicked, and
    // Chromium paints a hovered checkbox differently from a resting one.
    // Whether that paint has landed by the time the shot is taken is a race,
    // and it is the one this suite kept losing: three of five captures here
    // drifted, every one of them on a filtered desktop shot, and every one on
    // the pixels of the checkbox the pointer had been left over. Park it away
    // from the filters so the pane is captured at rest however the paint lands.
    await page.mouse.move(0, 0);
    // Unchecking also scrolls the filter it clicks into view, and the pane
    // then loses the rows that filter was showing -- so where the page ends up
    // scrolled to was decided by a layout that no longer exists. The pane
    // landed below the fold in one probe of eight, and a pane whose bottom
    // edge is off-screen rasterizes that edge differently: the shot's last row
    // came out white rather than the pane's own border. Settle the scroll on
    // the pane itself, once the rows it is captured with are the ones there.
    if (FILTERED.includes(state))
      await page
        .getByRole("region", { name: "Educated and Experienced" })
        .evaluate((pane) => pane.scrollIntoView({ block: "center" }));
  },
});

// The shared contract captures everything but `happy` at desktop only, and
// timeline.css re-lays-out the whole pane below 700px: the card loses its
// radius and gains a minimum height, the filters stretch and centre, the
// organisation column narrows to 66px, the axis hides every year but one, and
// every label swaps to its compact form. A visitor who opens any state on a
// phone therefore sees a layout no desktop shot covers.
const narrowScenarios: VisualScenario[] = scenarios
  .filter((scenario) => scenario.state !== "happy")
  .map((scenario) => ({ ...scenario, viewports: ["mobile"] }));

export const suite: VisualSuite = {
  project: "timeline",
  hostPath: "",
  scenarios: [...scenarios, ...narrowScenarios],
};
