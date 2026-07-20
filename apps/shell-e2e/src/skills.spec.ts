import { expect, type Page, test } from "@playwright/test";

const renderPaths = [
  { name: "host-composed", url: "" },
  { name: "standalone remote", url: "remotes/skills/" },
] as const;

async function openSkills(page: Page, url: string, state?: string) {
  await page.goto(state ? `${url}?skills-state=${state}` : url);
}

for (const renderPath of renderPaths) {
  test(`${renderPath.name} renders the recursive skills tree`, async ({
    page,
  }) => {
    await openSkills(page, renderPath.url);
    await expect(
      page.getByRole("heading", { name: "Skilled in…" }),
    ).toBeVisible();
    await expect(
      page.getByText("Browse 198 skills in 7 categories"),
    ).toBeVisible();
    await expect(
      page.getByRole("img", { name: "Skills sunburst chart" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Explore Programming category" }),
    ).toBeVisible();
    await expect(page.locator(".skill-sector")).toHaveCount(199);
  });

  test(`${renderPath.name} reveals stats on hover and keyboard focus`, async ({
    page,
  }) => {
    await openSkills(page, renderPath.url);
    const programming = page.getByRole("button", {
      name: "Explore Programming category",
    });
    await programming.hover();
    const stats = page.getByRole("complementary", { name: "Skill stats" });
    await expect(stats).toContainText("Programming");
    await expect(stats).toContainText("High Aptitude");
    await expect(stats).toContainText("Est. Hours: 21,724");
    await programming.focus();
    await expect(stats).toContainText("First used: 14 years ago");
  });

  test(`${renderPath.name} drills into and out of a category`, async ({
    page,
  }) => {
    await openSkills(page, renderPath.url);
    await page
      .getByRole("button", { name: "Explore Programming category" })
      .click();
    await expect(page.getByText("Programming expanded.")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Zoom out from Programming" }),
    ).toBeVisible();
    await expect(page.locator(".skill-sector")).toHaveCount(50);
    await page
      .getByRole("button", { name: "Zoom out from Programming" })
      .press("Enter");
    await expect(
      page.getByRole("button", { name: "Explore Frameworks category" }),
    ).toBeVisible();
  });

  test(`${renderPath.name} browses skills through accessible dropdowns`, async ({
    page,
  }) => {
    await openSkills(page, renderPath.url);
    await page.getByRole("button", { name: "View dropdowns" }).click();
    const category = page.getByLabel("Category", { exact: true });
    const skill = page.getByLabel("Skill", { exact: true });
    await category.selectOption("programming");
    await skill.selectOption("python");
    const stats = page.getByRole("complementary", { name: "Skill stats" });
    await expect(stats).toContainText("Python");
    await expect(stats).toContainText("High Aptitude");
    await expect(stats).toContainText("Est. Hours: 12,290");
    await page.getByRole("button", { name: "View chart" }).click();
    await expect(
      page.getByRole("img", { name: "Skills sunburst chart" }),
    ).toBeVisible();
  });

  for (const state of ["empty", "loading", "error"] as const) {
    test(`${renderPath.name} presents its ${state} state`, async ({ page }) => {
      await openSkills(page, renderPath.url, state);
      const expected =
        state === "empty"
          ? "No skills are available."
          : state === "loading"
            ? "Loading skills…"
            : "Skills unavailable";
      await expect(
        page.getByRole(state === "error" ? "alert" : "status"),
      ).toContainText(expected);
    });
  }

  test(`${renderPath.name} rejects an invalid preview state`, async ({
    page,
  }) => {
    await openSkills(page, renderPath.url, "not-a-skills-state");
    await expect(
      page.getByRole("img", { name: "Skills sunburst chart" }),
    ).toBeVisible();
  });

  for (const viewport of [
    { height: 900, name: "desktop", width: 1110 },
    { height: 1024, name: "tablet", width: 768 },
    { height: 812, name: "mobile", width: 375 },
  ] as const) {
    test(`${renderPath.name} is responsive at ${viewport.name}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await openSkills(page, renderPath.url);
      const pane = page.getByRole("region", { name: "Skilled in…" });
      const box = await pane.boundingBox();
      expect(box?.width).toBeLessThanOrEqual(viewport.width);
      await expect(
        page.getByRole("button", { name: "View dropdowns" }),
      ).toBeVisible();
    });
  }
}

test("standalone skills remote loads the shared design-system", async ({
  page,
}) => {
  await openSkills(page, "remotes/skills/");
  const tokens = await page
    .getByRole("region", { name: "Skilled in…" })
    .evaluate((element) => {
      const styles = getComputedStyle(element.ownerDocument.documentElement);
      return {
        fontFamily: styles.fontFamily,
        navy: styles.getPropertyValue("--navy").trim(),
      };
    });
  // llmlint: ignore[tests_mirror_real_usage] Pins shared visual tokens behind browser goldens.
  expect(tokens).toEqual({ fontFamily: "Arial, sans-serif", navy: "#12324a" });
});

for (const viewport of [
  { height: 900, name: "desktop", width: 1110 },
  { height: 1024, name: "tablet", width: 768 },
  { height: 812, name: "mobile", width: 375 },
] as const) {
  test(`standalone skills matches the ${viewport.name} visual golden`, async ({
    page,
  }) => {
    await page.clock.install({ time: new Date("2026-07-20T12:00:00Z") });
    await page.setViewportSize(viewport);
    await openSkills(page, "remotes/skills/");
    await expect(
      page.getByRole("region", { name: "Skilled in…" }),
    ).toHaveScreenshot(`skills-${viewport.name}.png`, {
      animations: "disabled",
    });
  });
}

test("standalone skills matches the expanded visual golden", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1110, height: 900 });
  await openSkills(page, "remotes/skills/");
  await page
    .getByRole("button", { name: "Explore Programming category" })
    .click();
  await expect(
    page.getByRole("region", { name: "Skilled in…" }),
  ).toHaveScreenshot("skills-expanded.png", { animations: "disabled" });
});
