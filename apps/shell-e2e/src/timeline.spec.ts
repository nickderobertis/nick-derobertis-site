import { expect, type Page, test } from "@playwright/test";

const renderPaths = [
  { name: "host-composed", url: "" },
  { name: "standalone remote", url: "remotes/timeline/" },
] as const;

async function openTimeline(page: Page, url: string, state?: string) {
  await page.goto(state ? `${url}?timeline-state=${state}` : url);
}

for (const renderPath of renderPaths) {
  test(`${renderPath.name} renders the complete timeline from CV data`, async ({
    page,
  }) => {
    await openTimeline(page, renderPath.url);
    await expect(
      page.getByRole("heading", { name: "Educated and Experienced" }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Education and employment by year"),
    ).toBeVisible();
    await expect(
      page.getByLabel(
        /Ph.D. in Business Administration.*University of Florida/,
      ),
    ).toBeVisible();
    await expect(
      page.getByLabel(/Staff Software Engineer at Carbon Health Technologies/),
    ).toBeVisible();
    await expect(
      page.getByLabel(/Graduate Assistant at University of Florida/),
    ).toBeVisible();
    await expect(
      page.getByText("Spendoso, LLC", { exact: true }),
    ).toBeVisible();
  });

  test(`${renderPath.name} filters education`, async ({ page }) => {
    await openTimeline(page, renderPath.url);
    await page.getByRole("checkbox", { name: "Employment" }).uncheck();
    await expect(
      page.getByLabel(/Ph.D. in Business Administration/),
    ).toBeVisible();
    await expect(page.getByLabel(/Staff Software Engineer/)).toHaveCount(0);
    await expect(page.getByLabel(/Graduate Assistant/)).toHaveCount(0);
  });

  test(`${renderPath.name} filters professional and academic employment`, async ({
    page,
  }) => {
    await openTimeline(page, renderPath.url);
    await page.getByRole("checkbox", { name: "Education" }).uncheck();
    await expect(page.getByLabel(/Staff Software Engineer/)).toBeVisible();
    await expect(
      page.getByLabel(/Graduate Assistant at University of Florida/),
    ).toBeVisible();
    await expect(
      page.getByLabel(/Ph.D. in Business Administration/),
    ).toHaveCount(0);
  });

  test(`${renderPath.name} reports no matching filter results`, async ({
    page,
  }) => {
    await openTimeline(page, renderPath.url);
    await page.getByRole("checkbox", { name: "Employment" }).uncheck();
    await page.getByRole("checkbox", { name: "Education" }).uncheck();
    await expect(page.getByRole("status")).toHaveText(
      "No timeline entries match the selected filters.",
    );
  });

  for (const state of ["empty", "loading", "error"] as const) {
    test(`${renderPath.name} presents its ${state} state`, async ({ page }) => {
      await openTimeline(page, renderPath.url, state);
      const expected =
        state === "empty"
          ? "No education or employment entries are available."
          : state === "loading"
            ? "Loading timeline…"
            : "Timeline unavailable";
      const role = state === "error" ? "alert" : "status";
      await expect(page.getByRole(role)).toContainText(expected);
    });
  }

  test(`${renderPath.name} uses compact labels at a mobile viewport`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openTimeline(page, renderPath.url);
    await expect(page.getByText("UF", { exact: true })).toBeVisible();
    await expect(page.getByText("Ph.D.", { exact: true })).toBeVisible();
    const card = page.getByRole("region", { name: "Timeline visualization" });
    const box = await card.boundingBox();
    expect(box?.width).toBeLessThanOrEqual(375);
  });
}
