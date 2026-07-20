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
      { query: "loading", heading: "Loading research" },
      { query: "empty", heading: "No research projects yet" },
      { query: "error", heading: "Research is unavailable" },
    ]) {
      test(`shows its ${state.query} state`, async ({ page }) => {
        await page.goto(`${renderPath.path}?research-state=${state.query}`);
        await expect(
          page.getByRole("heading", { name: state.heading }),
        ).toBeVisible();
        await expect(page.getByRole("article")).toHaveCount(0);
      });
    }

    test("reflows project panes on a narrow viewport", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(renderPath.path);
      const project = page.getByRole("article", {
        name: /Valuation without Cash Flows/,
      });
      await expect(project).toBeVisible();
      const columns = await project.evaluate(
        (element) => getComputedStyle(element).gridTemplateColumns,
      );
      expect(columns.trim().split(/\s+/)).toHaveLength(1);
      await expect(
        page.getByRole("link", { name: "View research" }),
      ).toBeVisible();
    });
  });
}
