import { expect, type Page, test } from "@playwright/test";

const renderPaths = [
  { name: "host-composed", path: "" },
  { name: "standalone remote", path: "remotes/awards/" },
] as const;

async function openAwards(page: Page, path: string, view?: string) {
  const query = view ? `?awards-view=${view}` : "";
  await page.goto(`${path}${query}`);
  await expect(
    page.getByRole("heading", { name: "Awards", exact: true }),
  ).toBeVisible();
}

for (const renderPath of renderPaths) {
  test(`${renderPath.name} renders selected and all awards with stats and optional parts`, async ({
    page,
  }) => {
    await openAwards(page, renderPath.path, "selected");
    await expect(
      page.getByLabel("Awards list").getByRole("article"),
    ).toHaveCount(4);
    await expect(
      page.getByLabel("Awards statistics").getByText("4", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Awards statistics").getByText("3", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Awards statistics").getByText("1", { exact: true }),
    ).toBeVisible();

    const withParts = page.getByRole("article").filter({
      has: page.getByRole("heading", {
        name: "Graduate Management Admission Test (GMAT) Score",
      }),
    });
    await expect(withParts.getByText("2014", { exact: true })).toBeVisible();
    await expect(
      withParts.getByLabel("Award details").getByRole("listitem"),
    ).toHaveCount(2);
    await expect(withParts.getByText("99.6 percentile")).toBeVisible();

    const withoutParts = page.getByRole("article").filter({
      has: page.getByRole("heading", { name: "Finance Student of the Year" }),
    });
    await expect(withoutParts.getByLabel("Award details")).toHaveCount(0);

    await openAwards(page, renderPath.path, "all");
    await expect(
      page.getByLabel("Awards list").getByRole("article"),
    ).toHaveCount(7);
    await expect(
      page.getByLabel("Awards statistics").getByText("7", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Awards statistics").getByText("5", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Awards statistics").getByText("4", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("$2000/yr")).toBeVisible();
  });

  test(`${renderPath.name} exposes loading, empty, and error states`, async ({
    page,
  }) => {
    await openAwards(page, renderPath.path, "loading");
    await expect(page.getByRole("status")).toHaveText("Loading awards…");
    await expect(page.getByLabel("Awards list")).toBeVisible();

    await openAwards(page, renderPath.path, "empty");
    await expect(page.getByRole("status")).toContainText("No awards to show");
    await expect(page.getByRole("article")).toHaveCount(0);

    await openAwards(page, renderPath.path, "error");
    await expect(page.getByRole("alert")).toContainText(
      "Awards are unavailable",
    );
    await expect(page.getByRole("article")).toHaveCount(0);
  });

  test(`${renderPath.name} awards grid responds from mobile through desktop`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openAwards(page, renderPath.path, "all");
    const columns = () =>
      page
        .getByLabel("Awards list")
        .evaluate(
          (element) =>
            getComputedStyle(element).gridTemplateColumns.split(" ").length,
        );
    expect(await columns()).toBe(1);

    await page.setViewportSize({ width: 800, height: 900 });
    expect(await columns()).toBe(2);

    await page.setViewportSize({ width: 1280, height: 900 });
    expect(await columns()).toBe(3);
  });
}
