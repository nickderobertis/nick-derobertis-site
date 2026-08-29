import type { VisualScenario, VisualSuite } from "@site/visual-harness";
import { standardVisualScenarios } from "@site/visual-harness/scenarios";

const states: ReadonlyArray<string> = ["empty", "loading", "error"];
const scenarios = standardVisualScenarios({
  states,
  query: (state) => `?state=${state}`,
  target: (page, state) =>
    state === "happy"
      ? page.locator("body")
      : state === "loading"
        ? page.getByRole("status").first()
        : page.locator(".pane-state").first(),
  // Home resolves its own page and then each pane's federated Page behind a
  // Suspense boundary of its own, so a pane that has not landed yet still
  // renders the skeleton it suspends on. Every target below names the first
  // element of a set the panes fill in as they arrive, so a shot taken before
  // they all have records whichever ones happened to win: `.pane-state`
  // first-matches a later pane while an earlier one is still suspended, and
  // `status` first-matches the host's own skeleton while the page it wraps is.
  // Waiting for the skeletons to go is what makes the shot the same however
  // the seven chunks arrive -- all of them in every state but `loading`, and
  // in `loading` the host's own, because the panes' are the subject there.
  prepare: async (page, state) => {
    await page
      .locator(state === "loading" ? ".skeleton-home" : ".remote-skeleton")
      .first()
      .waitFor({ state: "detached", timeout: 30_000 });
  },
});

// The shared contract captures everything but `happy` at desktop only, and each
// of the composed page's other states re-lays-out below that width: the pane
// skeletons drop from three columns to one under 48rem, and the empty and error
// panels are sized from the viewport rather than from their content. A visitor
// who previews any of those on a tablet or a phone therefore sees a layout no
// shot covers, so each state is captured at those widths too.
const narrowScenarios: VisualScenario[] = scenarios
  .filter((scenario) => scenario.state !== "happy")
  .map((scenario) => ({ ...scenario, viewports: ["tablet", "mobile"] }));

export const suite: VisualSuite = {
  project: "home",
  hostPath: "",
  scenarios: [...scenarios, ...narrowScenarios],
};
