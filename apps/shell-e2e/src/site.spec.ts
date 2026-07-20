import { expect, test } from "@playwright/test";

const pages = [
  { link: "Home", heading: "Finance, research, and software", path: "" },
  {
    link: "Bio",
    heading: "Biography",
    path: "bio",
    remote: /Biography remote loaded/,
  },
  {
    link: "Research",
    heading: "Research Works",
    staticHeading: "Research",
    path: "research",
  },
  {
    link: "Software",
    heading: "Open-Source Software",
    path: "software",
  },
  {
    link: "Courses",
    heading: "Courses",
    path: "courses",
  },
];

for (const route of pages)
  test(`${route.link} direct route resolves all project-path assets`, async ({
    page,
  }) => {
    const failures: string[] = [];
    page.on("response", (response) => {
      if (response.status() >= 400)
        failures.push(`${response.status()} ${response.url()}`);
    });
    await page.goto(route.path);
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: route.heading }),
    ).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
    if (route.remote)
      await expect(page.getByRole("status")).toHaveText(route.remote);
    expect(failures).toEqual([]);
  });

test("every route has useful HTML with JavaScript disabled", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  for (const route of pages) {
    await page.goto(route.path);
    await expect(
      page.getByRole("heading", {
        name: "staticHeading" in route ? route.staticHeading : route.heading,
      }),
    ).toBeVisible();
  }
  await context.close();
});

test("navigation works with the keyboard", async ({ page }) => {
  await page.goto("");
  await page.getByRole("link", { name: "Bio" }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/bio$/);
  await expect(page.getByRole("heading", { name: "Biography" })).toBeVisible();
});

test("the static 404 is intentional and the router recovers unknown routes", async ({
  browser,
  page,
}) => {
  const noScript = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await noScript.newPage();
  await staticPage.goto("missing");
  await expect(
    staticPage.getByRole("heading", { name: "Loading requested page" }),
  ).toBeVisible();
  await noScript.close();

  await page.goto("missing");
  await expect(page).toHaveURL(/nick-derobertis-site\/?$/);
  await expect(
    page.getByRole("heading", { name: "Finance, research, and software" }),
  ).toBeVisible();
});
