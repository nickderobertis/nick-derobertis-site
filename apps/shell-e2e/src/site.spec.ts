import { expect, test } from "@playwright/test";

const pages = [
  { link: "Home", heading: "Finance, research, and software", path: "" },
  { link: "Bio", heading: "Biography", path: "bio" },
  { link: "Research", heading: "Research", path: "research" },
  { link: "Software", heading: "Software", path: "software" },
  { link: "Courses", heading: "Courses", path: "courses" },
];
for (const page of pages)
  test(`${page.link} route renders through the shell`, async ({
    page: browser,
  }) => {
    await browser.goto(page.path);
    await expect(browser.getByRole("banner")).toBeVisible();
    await expect(
      browser.getByRole("heading", { name: page.heading }),
    ).toBeVisible();
    await expect(browser.getByRole("contentinfo")).toBeVisible();
  });
test("navigation works with the keyboard", async ({ page }) => {
  await page.goto("");
  await page.getByRole("link", { name: "Bio" }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/bio$/);
  await expect(page.getByRole("heading", { name: "Biography" })).toBeVisible();
});
test("unknown routes recover to home", async ({ page }) => {
  await page.goto("missing");
  await expect(page).toHaveURL(/nick-derobertis-site\/?$/);
  await expect(
    page.getByRole("heading", { name: "Finance, research, and software" }),
  ).toBeVisible();
});
