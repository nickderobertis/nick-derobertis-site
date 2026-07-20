import { expect, type Page, test } from "@playwright/test";

const allAwardsPaths = [
  { name: "host-composed", path: "awards" },
  { name: "standalone remote", path: "remotes/awards/" },
] as const;

async function openAwards(page: Page, path: string) {
  await page.goto(path);
  await expect(
    page.getByRole("heading", { name: "Awards", exact: true }),
  ).toBeVisible();
}

test("home renders the data-access selected awards subset", async ({
  page,
}) => {
  await openAwards(page, "");
  await expect(page.getByLabel("Awards list").getByRole("article")).toHaveCount(
    4,
  );
  await expect(
    page.getByRole("heading", { name: "Finance Student of the Year" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Warrington Finance Ph.D. Research Grants",
    }),
  ).toHaveCount(0);
});

for (const renderPath of allAwardsPaths) {
  test(`${renderPath.name} renders all awards, stats, extra info, and award parts`, async ({
    page,
  }) => {
    await openAwards(page, renderPath.path);
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

    const withParts = page.getByRole("article").filter({
      has: page.getByRole("heading", {
        name: "Graduate Management Admission Test (GMAT) Score",
      }),
    });
    await expect(withParts.getByText("2014", { exact: true })).toBeVisible();
    await expect(withParts.getByText("780", { exact: true })).toBeVisible();
    await expect(
      withParts.getByLabel("Award parts").getByRole("listitem"),
    ).toHaveCount(1);
    await expect(withParts.getByText("99.6 percentile")).toBeVisible();

    const extraInfoOnly = page.getByRole("article").filter({
      has: page.getByRole("heading", {
        name: "Warrington Finance Ph.D. Research Grants",
      }),
    });
    await expect(extraInfoOnly.getByText("$2000/yr")).toBeVisible();
    await expect(extraInfoOnly.getByLabel("Award parts")).toHaveCount(0);

    const withoutInfo = page.getByRole("article").filter({
      has: page.getByRole("heading", { name: "Finance Student of the Year" }),
    });
    await expect(withoutInfo.getByText("2013", { exact: true })).toBeVisible();
    await expect(withoutInfo.getByLabel("Award parts")).toHaveCount(0);
  });

  test(`${renderPath.name} exposes genuine loading and empty data outcomes`, async ({
    page,
  }) => {
    await page.setExtraHTTPHeaders({ "x-awards-outcome": "delay" });
    await page.goto(renderPath.path);
    await expect(page.getByRole("status")).toHaveText("Loading awards…");
    await expect(page.getByLabel("Awards list")).toBeVisible();

    await page.setExtraHTTPHeaders({ "x-awards-outcome": "empty" });
    await openAwards(page, renderPath.path);
    await expect(page.getByRole("status")).toContainText("No awards to show");
    await expect(page.getByRole("article")).toHaveCount(0);
  });

  test(`${renderPath.name} surfaces and recovers from a genuine data error`, async ({
    page,
  }) => {
    await page.setExtraHTTPHeaders({ "x-awards-outcome": "error" });
    await openAwards(page, renderPath.path);
    await expect(page.getByRole("alert")).toContainText(
      "Awards are unavailable",
    );
    await page.setExtraHTTPHeaders({});
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByLabel("Awards list")).toBeVisible();
  });

  test(`${renderPath.name} awards grid responds from mobile through desktop`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openAwards(page, renderPath.path);
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

  test(`${renderPath.name} matches the awards visual baseline`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 1600 });
    await openAwards(page, renderPath.path);
    await expect(page).toHaveScreenshot(
      `${renderPath.name.replace(" ", "-")}-awards.png`,
      { animations: "disabled", fullPage: true },
    );
  });
}
