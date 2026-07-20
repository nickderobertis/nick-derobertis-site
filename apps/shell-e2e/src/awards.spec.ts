import { expect, test } from "@playwright/test";

const renderPaths = [
  { label: "host-composed", path: "" },
  { label: "standalone", path: "remotes/awards/" },
] as const;

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
      expect(await pane.screenshot()).toMatchSnapshot(
        `awards-${renderPath.label}-all.png`,
      );
    });

    for (const state of [
      { scenario: "empty", heading: "No awards yet", role: "status" as const },
      {
        scenario: "error",
        heading: "Awards unavailable",
        role: "alert" as const,
      },
    ]) {
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
        expect(await statePanel.screenshot()).toMatchSnapshot(
          `awards-${renderPath.label}-${state.scenario}.png`,
        );
      });
    }

    test("renders loading while the awards boundary is pending", async ({
      page,
    }) => {
      await page.goto(`${renderPath.path}?awards-scenario=loading`);
      const loading = page.getByRole("status");
      await expect(loading).toContainText("Loading awards…");
      expect(await loading.screenshot()).toMatchSnapshot(
        `awards-${renderPath.label}-loading.png`,
      );
      await expect(
        page.getByRole("heading", { name: "Selected awards" }),
      ).toBeAttached();
    });

    for (const viewport of [
      { name: "desktop", width: 1110, height: 900 },
      { name: "tablet", width: 690, height: 1024 },
      { name: "mobile", width: 345, height: 844 },
    ]) {
      test(`matches the ${viewport.name} selected-awards design`, async ({
        page,
      }) => {
        await page.setViewportSize(viewport);
        await page.goto(renderPath.path);
        const pane = page.getByRole("region", { name: "Selected awards" });
        await expect(pane).toBeVisible();
        const box = await pane.boundingBox();
        expect(box?.x).toBeGreaterThanOrEqual(0);
        expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(
          viewport.width + 1,
        );
        expect(await pane.screenshot()).toMatchSnapshot(
          `awards-${renderPath.label}-${viewport.name}.png`,
        );
      });
    }
  });
}
