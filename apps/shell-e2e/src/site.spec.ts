import { expect, test } from "@playwright/test";

const pages = [
  {
    link: "Home",
    heading: "Finance researcher & educator",
    staticHeading: "Finance, research, and software",
    path: "",
  },
  {
    link: "Bio",
    heading: "Optimizing Life",
    path: "bio",
  },
  {
    link: "Research",
    heading: "Research Works",
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
    await expect(page).toHaveTitle(/Nick DeRobertis/);
  }
  await context.close();
});

test("every prerendered route contains substantive feature content", async ({
  browser,
}) => {
  const expected = [
    ["", "Who am I?"],
    ["bio", "Reproducible Research"],
    ["research", "Valuation without Cash Flows"],
    ["software", "Python Tools for Working with Data"],
    ["courses", "Financial Modeling"],
  ] as const;
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  for (const [path, content] of expected) {
    await page.goto(path);
    await expect(
      page.getByText(content, { exact: false }).first(),
    ).toBeVisible();
  }
  await context.close();
});

test("navigation works with the keyboard", async ({ page }) => {
  await page.goto("");
  await page.getByRole("link", { name: "Bio", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/bio$/);
  await expect(
    page.getByRole("heading", { name: "Optimizing Life" }),
  ).toBeVisible();
});

test("leaf routes reuse prerendered DOM without hydration warnings and navigate as an SPA", async ({
  browser,
}) => {
  for (const route of pages.filter(({ path }) => path)) {
    const page = await browser.newPage();
    const errors: string[] = [];
    await page.addInitScript(() => {
      const observer = new MutationObserver(() => {
        const main = document.querySelector("#root > main");
        if (main && !Reflect.get(window, "__prerenderedMain")) {
          Reflect.set(window, "__prerenderedMain", main);
          observer.disconnect();
        }
      });
      observer.observe(document, { childList: true, subtree: true });
    });
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto(route.path, { waitUntil: "networkidle" });
    await expect(
      page.getByRole("heading", { name: route.heading }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          Reflect.get(window, "__prerenderedMain") ===
          document.querySelector("#root > main"),
      ),
    ).toBe(true);
    expect(errors).toEqual([]);

    let documentRequests = 0;
    page.on("request", (request) => {
      if (request.isNavigationRequest()) documentRequests += 1;
    });
    await page.getByRole("link", { name: "Home", exact: true }).click();
    await expect(page).toHaveURL(/nick-derobertis-site\/$/);
    await page.getByRole("link", { name: route.link, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${route.path}$`));
    expect(documentRequests).toBe(0);
    await page.close();
  }
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
    page.getByRole("heading", { name: "Finance researcher & educator" }),
  ).toBeVisible();
});
