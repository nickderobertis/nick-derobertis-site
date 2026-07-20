import { expect, type Page, test } from "@playwright/test";

const renderPaths = [
  { name: "host-composed", path: "bio" },
  { name: "standalone", path: "remotes/bio/" },
] as const;

async function expectBiography(page: Page) {
  await expect(
    page.getByRole("heading", { name: "Optimizing Life", level: 1 }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Early Days" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Reproducible Research" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Day to Day" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "many of these tools" }),
  ).toHaveAttribute("href", "https://github.com/nickderobertis");
}

for (const renderPath of renderPaths) {
  test(`${renderPath.name} renders the complete biography`, async ({
    page,
  }) => {
    await page.goto(renderPath.path);
    await expectBiography(page);
    await expect(page.getByText(/born and raised in Virginia/)).toBeVisible();
    await expect(page.getByText(/traveling around the U\.S\./)).toBeVisible();
  });

  test(`${renderPath.name} exposes loading, empty, and error states`, async ({
    page,
  }) => {
    await page.goto(`${renderPath.path}?bio-view=loading`);
    await expect(page.getByRole("status")).toContainText("Loading biography");
    await expectBiography(page);

    await page.goto(`${renderPath.path}?bio-view=empty`);
    await expect(page.getByRole("status")).toContainText(
      "Biography coming soon",
    );
    await expect(page.getByRole("article")).toHaveCount(0);

    await page.goto(`${renderPath.path}?bio-view=error`);
    await expect(page.getByRole("alert")).toContainText(
      "Biography unavailable",
    );
    await expect(page.getByRole("article")).toHaveCount(0);
  });

  for (const viewport of [
    { name: "mobile", width: 390, height: 844 },
    { name: "tablet", width: 783, height: 1024 },
    { name: "desktop", width: 1455, height: 900 },
  ]) {
    test(`${renderPath.name} matches the ${viewport.name} biography layout`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto(renderPath.path);
      await expectBiography(page);
      const article = page.getByRole("article", { name: "Optimizing Life" });
      const box = await article.boundingBox();
      expect(box).not.toBeNull();
      expect(box?.width).toBeCloseTo(viewport.width, 0);
      await expect(article).toHaveCSS("overflow", "hidden");
    });
  }
}

test("the legacy story route redirects to the host-composed biography", async ({
  page,
}) => {
  await page.goto("story");
  await expect(page).toHaveURL(/\/bio$/);
  await expectBiography(page);
});
