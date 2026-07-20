import { expect, type Page, test } from "@playwright/test";

const renderPaths = [
  { name: "host-composed", path: "bio" },
  { name: "standalone remote", path: "remotes/bio/" },
] as const;

async function openBio(page: Page, path: string, view?: string) {
  await page.goto(view ? `${path}?bio-view=${view}` : path);
  await expect(
    page.getByRole("heading", { name: "Optimizing Life" }),
  ).toBeVisible();
}

for (const renderPath of renderPaths) {
  test(`${renderPath.name} renders the complete story and structured highlights`, async ({
    page,
  }) => {
    await openBio(page, renderPath.path);

    await expect(page.getByLabel("Nick DeRobertis's story")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Early Days" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Philosophy" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Reproducible Research" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Day to Day" }),
    ).toBeVisible();
    await expect(page.getByLabel("Biography highlights")).toContainText(
      "University of Florida",
    );
    await expect(
      page.getByText(/tens of thousands of lines of code/),
    ).toBeVisible();
  });

  test(`${renderPath.name} exposes loading, empty, and error states`, async ({
    page,
  }) => {
    await page.goto(`${renderPath.path}?bio-view=loading`);
    await expect(page.getByRole("status")).toHaveText("Loading biography…");
    await expect(
      page.getByRole("heading", { name: "Optimizing Life" }),
    ).toBeVisible();

    await page.goto(`${renderPath.path}?bio-view=empty`);
    await expect(page.getByRole("status")).toContainText(
      "Biography coming soon",
    );

    await page.goto(`${renderPath.path}?bio-view=error`);
    await expect(page.getByRole("alert")).toContainText(
      "Biography unavailable",
    );
  });

  test(`${renderPath.name} story responds from mobile through desktop`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openBio(page, renderPath.path);
    const cover = page.getByLabel("Biography cover");
    const prose = page.getByRole("region", { name: "Biography prose" });
    const mobileCover = await cover.boundingBox();
    const mobileProse = await prose.boundingBox();
    expect(mobileCover).not.toBeNull();
    expect(mobileProse).not.toBeNull();
    expect(mobileCover?.width).toBeLessThanOrEqual(390);
    expect(mobileProse?.width).toBeLessThanOrEqual(390);

    await page.setViewportSize({ width: 1280, height: 900 });
    const desktopCover = await cover.boundingBox();
    const desktopProse = await prose.boundingBox();
    expect(desktopCover?.width).toBeGreaterThan(mobileCover?.width ?? 0);
    expect(desktopProse?.width).toBeGreaterThan(mobileProse?.width ?? 0);
    expect(desktopProse?.width).toBeLessThan(850);
  });
}

test("legacy story route redirects to the host-composed biography", async ({
  page,
}) => {
  await page.goto("story");
  await expect(page).toHaveURL(/\/bio$/);
  await expect(
    page.getByRole("heading", { name: "Optimizing Life" }),
  ).toBeVisible();
});
