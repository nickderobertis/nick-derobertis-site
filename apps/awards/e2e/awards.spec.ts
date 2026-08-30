import { expect, test } from "@playwright/test";

const renderPaths: readonly { label: string; path: string }[] = [
  { label: "host-composed", path: "" },
  { label: "standalone", path: "remotes/awards/" },
];

type Viewport = { name: string; width: number; height: number };

const phone: Viewport = { name: "mobile", width: 345, height: 844 };
const viewports: readonly Viewport[] = [
  { name: "desktop", width: 1110, height: 900 },
  { name: "tablet", width: 690, height: 1024 },
  phone,
];

const dataBoundaryStates: readonly {
  scenario: string;
  heading: string;
  role: "status" | "alert";
}[] = [
  { scenario: "empty", heading: "No awards yet", role: "status" },
  { scenario: "error", heading: "Awards unavailable", role: "alert" },
  // A 200 the CV schema rejects: the pane's validator is the only thing between
  // that answer and a visitor, so it has to land on the same recovery panel.
  // llmlint: ignore[browser_journeys_run_against_the_built_app, expensive_tests_stay_behind_their_own_edge] This workspace gives each remote one journey suite of its own, and `awards:e2e` composes and serves the real Pages artifact before it runs, so these cases drive the deployed bytes on both render paths. The edge they sit behind is the remote's: Nx selects `awards:e2e` only for changes reaching awards, and a scenario-specific project would split one remote's coverage across two boundaries for four cases.
  { scenario: "schema-invalid", heading: "Awards unavailable", role: "alert" },
];

for (const renderPath of renderPaths) {
  test.describe(`awards ${renderPath.label}`, () => {
    test("renders the selected awards subset with optional card content", async ({
      page,
    }) => {
      await page.goto(renderPath.path);
      await expect(
        page.getByRole("heading", { name: "Selected awards" }),
      ).toBeAttached();
      const pane = page.getByRole("region", { name: "Selected awards" });
      await expect(pane.getByRole("article")).toHaveCount(4);
      const detailed = pane.getByRole("article", {
        name: "Graduate Management Admission Test (GMAT)",
      });
      await expect(detailed).toContainText("2014");
      expect(await detailed.ariaSnapshot()).toContain("2014");
      await expect(detailed.getByRole("listitem")).toHaveText([
        "780 score",
        "99.6 percentile",
      ]);
      await expect(
        detailed.getByText("780 score", { exact: true }),
      ).toHaveCount(1);
      await expect(
        detailed.getByText("99.6 percentile", { exact: true }),
      ).toHaveCount(1);
      const simple = pane.getByRole("article", {
        name: "Finance Student of the Year",
      });
      await expect(simple).toContainText("2013");
      await expect(simple.getByRole("listitem")).toHaveText([
        "Virginia Commonwealth University",
      ]);
    });

    test("renders all awards and their statistics", async ({ page }) => {
      await page.goto(`${renderPath.path}?awards-view=all`);
      await expect(
        page.getByRole("heading", { name: "Awards & honors" }),
      ).toBeAttached();
      const pane = page.getByRole("region", { name: "Awards & honors" });
      await expect(pane.getByRole("article")).toHaveCount(7);
      await expect(pane.getByRole("definition")).toHaveText([
        "7",
        "2010–2019",
        "4",
      ]);
      await expect(
        pane.getByRole("article", {
          name: "Warrington Finance Ph.D. Research Grants",
        }),
      ).toContainText("$2000/yr");
    });

    for (const state of dataBoundaryStates) {
      test(`renders the ${state.scenario} data-boundary state`, async ({
        page,
      }) => {
        const responsePromise = page.waitForResponse(
          (response) =>
            response.url().includes("/cv-data/domains/awards.json") &&
            response.url().includes(`scenario=${state.scenario}`),
        );
        await page.goto(`${renderPath.path}?awards-scenario=${state.scenario}`);
        const response = await responsePromise;
        expect(response.status()).toBe(state.scenario === "error" ? 503 : 200);
        const statePanel = page.getByRole(state.role);
        await expect(
          statePanel.getByRole("heading", { name: state.heading }),
        ).toBeVisible();
        await expect(
          page.getByRole("article", {
            name: /GMAT Score|Finance Student of the Year/,
          }),
        ).toHaveCount(0);
      });
    }

    test("renders its skeleton while the awards boundary is pending", async ({
      page,
    }) => {
      // The pane asks for its awards only once its own page code has arrived,
      // and the served loading scenario then holds that response open from
      // there, so the window this asserts in belongs to the request the pane
      // really makes rather than to whichever of the two the machine finished
      // first.
      await page.goto(`${renderPath.path}?awards-scenario=loading`);
      await expect(
        page.getByRole("status", { name: "Loading awards", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Selected awards" }),
      ).toBeAttached();
    });

    for (const viewport of viewports)
      for (const view of [
        {
          label: "selected-awards",
          query: "",
          name: "Selected awards",
          cards: 4,
        },
        {
          label: "all-awards",
          query: "?awards-view=all",
          name: "Awards & honors",
          cards: 7,
        },
      ]) {
        test(`fits the ${viewport.name} ${view.label} viewport`, async ({
          page,
        }) => {
          await page.setViewportSize(viewport);
          await page.goto(`${renderPath.path}${view.query}`);
          const pane = page.getByRole("region", { name: view.name });
          await expect(pane).toBeVisible();
          await expect(pane.getByRole("article")).toHaveCount(view.cards);
          const box = await pane.boundingBox();
          expect(box?.x).toBeGreaterThanOrEqual(0);
          expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(
            viewport.width + 1,
          );
          // Every card has to wrap inside the pane: a grid that overflows it
          // pushes an award off the side of a phone with nothing to scroll to.
          const overflow = await pane.evaluate(
            (element) => element.scrollWidth - element.clientWidth,
          );
          expect(overflow).toBeLessThanOrEqual(1);
        });
      }

    for (const state of dataBoundaryStates)
      test(`fits the ${state.scenario} state onto a phone`, async ({
        page,
      }) => {
        await page.setViewportSize(phone);
        await page.goto(`${renderPath.path}?awards-scenario=${state.scenario}`);
        const statePanel = page
          .getByRole(state.role)
          .filter({ has: page.getByRole("heading", { name: state.heading }) });
        await expect(statePanel).toBeVisible();
        const box = await statePanel.boundingBox();
        expect(box?.x).toBeGreaterThanOrEqual(0);
        expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(
          phone.width + 1,
        );
      });
  });
}
