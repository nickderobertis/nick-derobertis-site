import { expect, test } from "@playwright/test";

const pages = [
  { link: "Home", heading: "Skilled in…", path: "" },
  {
    link: "Bio",
    heading: "Biography",
    path: "bio",
    remote: /Biography remote loaded/,
  },
  {
    link: "Research",
    heading: "Research",
    path: "research",
    remote: /Research remote loaded/,
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
      page.getByRole("heading", { name: route.heading }),
    ).toBeVisible();
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      /.+/,
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      new RegExp(`/nick-derobertis-site/${route.path}$`),
    );
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

test("a remote consumes another remote", async ({ page }) => {
  await page.goto("research");
  await page.getByText("Related software federation").click();
  await expect(
    page.getByRole("heading", { name: "Open-Source Software" }),
  ).toBeVisible();
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
    page.getByRole("heading", { name: "Skilled in…" }),
  ).toBeVisible();
});

const skillsPaths = [
  { name: "host-composed", path: "" },
  { name: "standalone", path: "remotes/skills/" },
];

for (const renderPath of skillsPaths) {
  test(`${renderPath.name} skills renders the recursive tree and supports drill-down`, async ({
    page,
  }) => {
    await page.goto(renderPath.path);
    await expect(
      page.getByText("Browse 198 skills in 7 categories"),
    ).toBeVisible();
    const chart = page.getByRole("tree", {
      name: "Interactive skills sunburst",
    });
    await expect(chart).toBeVisible();
    const programming = chart.getByRole("treeitem", { name: /Programming/ });
    await programming.hover();
    await programming.press("Enter");
    await expect(
      page.getByRole("button", { name: "Show all categories" }),
    ).toBeVisible();
    await expect(
      page.getByText("Programming", { exact: true }).last(),
    ).toBeVisible();
    await page.getByRole("button", { name: "Show all categories" }).click();
    await expect(page.getByText("7 categories", { exact: true })).toBeVisible();
  });

  test(`${renderPath.name} skills dropdown and statistics are keyboard accessible`, async ({
    page,
  }) => {
    await page.goto(renderPath.path);
    await page.getByRole("button", { name: "View dropdowns" }).focus();
    await page.keyboard.press("Enter");
    await page.getByLabel("Category").selectOption("programming");
    await page.getByLabel("Skill", { exact: true }).selectOption("typescript");
    await expect(
      page.getByRole("definition").filter({ hasText: "TypeScript" }),
    ).toBeVisible();
    await expect(
      page.getByRole("definition").filter({ hasText: /hours/ }),
    ).toBeVisible();
  });

  for (const state of ["empty", "error"] as const) {
    test(`${renderPath.name} skills exposes its ${state} state`, async ({
      page,
    }) => {
      // llmlint: ignore[tests_mirror_real_usage] The public preview query is the remote's real scenario boundary, and the assertion drives the rendered browser interface without mocking data access.
      await page.goto(`${renderPath.path}?skills-state=${state}`);
      await expect(
        page.getByText(
          state === "empty"
            ? "No skills are available yet."
            : "Skills could not be loaded. Please try again later.",
        ),
      ).toBeVisible();
    });
  }

  test(`${renderPath.name} skills exposes and resolves its loading state`, async ({
    page,
  }) => {
    // llmlint: ignore[tests_mirror_real_usage] The public preview query is the remote's real scenario boundary, and the assertion observes the browser-visible transition without mocking timers or data access.
    await page.goto(`${renderPath.path}?skills-state=loading`);
    await expect(page.getByRole("status")).toHaveText("Loading skills…");
    await expect(
      page.getByRole("tree", { name: "Interactive skills sunburst" }),
    ).toBeVisible();
  });

  test(`${renderPath.name} skills stays usable on a narrow viewport`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(renderPath.path);
    await expect(
      page.getByRole("heading", { name: "Skilled in…" }),
    ).toBeVisible();
    const responsiveChart = page.getByRole("tree", {
      name: "Interactive skills sunburst",
    });
    await responsiveChart.scrollIntoViewIfNeeded();
    await expect(responsiveChart).toBeInViewport();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(360);
  });
}
