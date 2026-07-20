import { expect, test } from "@playwright/test";

const renderPaths = [
  { label: "host-composed", path: "research" },
  { label: "standalone", path: "remotes/research/" },
] as const;

for (const renderPath of renderPaths) {
  test.describe(`research ${renderPath.label}`, () => {
    test("shows working papers, works in progress, and category groupings", async ({
      page,
    }) => {
      await page.goto(renderPath.path);
      await expect(
        page.getByRole("heading", { name: "Research Works" }),
      ).toBeVisible();
      const workingPapers = page.getByRole("region", {
        name: "Working Papers",
      });
      const worksInProgress = page.getByRole("region", {
        name: "Works in Progress",
      });
      await expect(workingPapers.getByRole("article")).toHaveCount(4);
      await expect(worksInProgress.getByRole("article")).toHaveCount(5);
      const cryptoProject = workingPapers.getByRole("article", {
        name: /Valuation without Cash Flows/,
      });
      await expect(
        cryptoProject.getByRole("list", { name: "Research categories" }),
      ).toContainText("Crypto-assets");
      await expect(
        cryptoProject.getByRole("list", { name: "Research categories" }),
      ).toContainText("Investor Sentiment");
    });

    test("shows coauthors and resources only when a project has them", async ({
      page,
    }) => {
      await page.goto(renderPath.path);
      const withResource = page.getByRole("article", {
        name: /Valuation without Cash Flows/,
      });
      await expect(
        withResource.getByRole("heading", { name: "Resources" }),
      ).toBeVisible();
      await expect(
        withResource.getByRole("link", { name: "Overview Video" }),
      ).toHaveAttribute("href", "https://youtu.be/8mMqLpFPK7M");
      const withCoauthors = page.getByRole("article", {
        name: /Government Equity Capital Market Intervention/,
      });
      await expect(withCoauthors).toContainText(
        "With Andy Naranjo, Mahendrarajah Nimalendran",
      );
      await expect(
        withCoauthors.getByRole("heading", { name: "Resources" }),
      ).toHaveCount(0);
      await expect(withResource.getByText(/^With /)).toHaveCount(0);
    });

    for (const state of [
      { scenario: "empty", heading: "No research projects yet" },
      { scenario: "error", heading: "Research is unavailable" },
    ]) {
      test(`shows its ${state.scenario} state from the data boundary`, async ({
        page,
      }) => {
        const responsePromise = page.waitForResponse(
          (response) =>
            response.url().includes("/cv-data/domains/research.json") &&
            response.url().includes(`scenario=${state.scenario}`),
        );
        await page.goto(
          `${renderPath.path}?research-scenario=${state.scenario}`,
        );
        const response = await responsePromise;
        expect(response.status()).toBe(state.scenario === "error" ? 503 : 200);
        await expect(
          page.getByRole("heading", { name: state.heading }),
        ).toBeVisible();
        await expect(page.getByRole("article")).toHaveCount(0);
      });
    }

    test("shows loading while the data boundary is pending, then renders", async ({
      page,
    }) => {
      await page.goto(`${renderPath.path}?research-scenario=loading`);
      await expect(
        page.getByRole("heading", { name: "Loading research" }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Research Works" }),
      ).toBeVisible();
    });

    test("reflows project panes on a narrow viewport", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(renderPath.path);
      const project = page.getByRole("article", {
        name: /Valuation without Cash Flows/,
      });
      await expect(project).toBeVisible();
      const categories = await project
        .getByRole("list", { name: "Research categories" })
        .boundingBox();
      const heading = await project
        .getByRole("heading", { name: /Valuation without Cash Flows/ })
        .boundingBox();
      expect(categories).not.toBeNull();
      expect(heading).not.toBeNull();
      expect(categories?.y).toBeLessThan(heading?.y ?? 0);
      await expect(
        page.getByRole("link", { name: "View research" }),
      ).toBeVisible();
    });

    for (const viewport of [
      { name: "desktop", width: 1455, height: 900 },
      { name: "tablet", width: 783, height: 1024 },
      { name: "mobile", width: 390, height: 844 },
    ]) {
      test(`matches the ${viewport.name} research design`, async ({ page }) => {
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });
        await page.goto(renderPath.path);
        await expect(
          page.getByRole("heading", { name: "Research Works" }),
        ).toBeVisible();
        expect(await page.screenshot()).toMatchSnapshot(
          `research-${renderPath.label}-${viewport.name}.png`,
        );
        const firstProject = page.getByRole("article", {
          name: /Valuation without Cash Flows/,
        });
        await firstProject.scrollIntoViewIfNeeded();
        expect(await firstProject.screenshot()).toMatchSnapshot(
          `research-project-${renderPath.label}-${viewport.name}.png`,
        );
      });
    }
  });
}
