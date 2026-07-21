import { expect, type Page, test } from "@playwright/test";

const renderPaths = [
  { name: "host-composed", url: "" },
  { name: "standalone remote", url: "remotes/timeline/" },
] as const;

const timelineRows = [
  "Ph.D. in Business Administration - Finance and Real Estate at University of Florida, 2014-08-15 to 2021-05-15",
  "Master of Science in Business, Concentration in Finance at Virginia Commonwealth University, 2013-08-15 to 2014-05-15",
  "Bachelor of Science in Business, Concentration in Finance at Virginia Commonwealth University, 2010-08-15 to 2013-05-15",
  "Co-Founder and Chief Technology Officer at Spendoso, LLC, 2022-08-01 to present",
  "Lead Product Manager and Engineer at Stealth Mode Startup, 2022-11-25 to present",
  "Staff Software Engineer at Carbon Health Technologies, 2022-09-01 to present",
  "Co-Founder and Chief Technology Officer at Claimfound, Inc., 2016-08-15 to 2022-12-31",
  "Senior Software Engineer at Carbon Health Technologies, 2021-04-12 to 2022-08-31",
  "Tutor at Parliament Tutors, 2017-09-01 to 2021-04-12",
  "Managing Partner at CNC Partners, 2013-05-15 to 2014-08-15",
  "Portfolio Analyst, Portfolio Management at Eastern Virginia Bankshares, 2012-08-15 to 2013-08-15",
  "Credit Risk Intern, Banking Supervision & Regulation at Federal Reserve Board of Governors, 2011-05-15 to 2011-08-15",
  "Graduate Assistant at University of Florida, 2014-08-15 to 2021-05-31",
  "Graduate Assistant at Virginia Commonwealth University, 2013-09-01 to 2014-08-15",
] as const;

const timelineColors = [
  [timelineRows[0], "rgb(177, 58, 69)"],
  [timelineRows[1], "rgb(169, 0, 38)"],
  [timelineRows[2], "rgb(169, 79, 200)"],
  [timelineRows[3], "rgb(127, 17, 12)"],
  [timelineRows[4], "rgb(40, 52, 74)"],
  [timelineRows[5], "rgb(187, 165, 237)"],
  [timelineRows[6], "rgb(139, 16, 16)"],
  [timelineRows[7], "rgb(172, 116, 16)"],
  [timelineRows[8], "rgb(192, 85, 169)"],
  [timelineRows[9], "rgb(239, 62, 102)"],
  [timelineRows[10], "rgb(22, 60, 138)"],
  [timelineRows[11], "rgb(255, 183, 227)"],
  [timelineRows[12], "rgb(221, 52, 52)"],
  [timelineRows[13], "rgb(221, 52, 52)"],
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
    for (const row of timelineRows)
      await expect(page.getByLabel(row, { exact: true })).toBeAttached();
    await expect(page.getByLabel(/ at /)).toHaveCount(timelineRows.length);
    for (const [row, color] of timelineColors)
      await expect(page.getByLabel(row, { exact: true })).toHaveCSS(
        "background-color",
        color,
      );
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
      await expect(
        page.getByRole(role).filter({ hasText: expected }),
      ).toBeVisible();
    });
  }

  test(`${renderPath.name} rejects an invalid timeline state`, async ({
    page,
  }) => {
    await openTimeline(page, renderPath.url, "not-a-timeline-state");
    await expect(
      page.getByLabel("Education and employment by year"),
    ).toBeVisible();
  });

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

test("standalone remote loads the shared design-system foundation", async ({
  page,
}) => {
  await openTimeline(page, "remotes/timeline/");
  const rootStyles = await page
    .getByRole("region", { name: "Educated and Experienced" })
    .evaluate((element) => {
      const styles = getComputedStyle(element.ownerDocument.documentElement);
      return {
        fontFamily: styles.fontFamily,
        navy: styles.getPropertyValue("--navy").trim(),
        paper: styles.getPropertyValue("--paper").trim(),
      };
    });
  // llmlint: ignore[tests_mirror_real_usage] Pins the font contract behind the browser visual goldens.
  expect(rootStyles.fontFamily).toBe("Arial, sans-serif");
  expect(rootStyles.navy).toBe("#12324a");
  expect(rootStyles.paper).toBe("#fff");
});
