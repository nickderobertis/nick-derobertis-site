import { expect, type Page, test } from "@playwright/test";

const renderPaths = [
  { name: "host-composed", path: "software" },
  { name: "standalone remote", path: "remotes/software/" },
] as const;

async function openSoftware(page: Page, path: string, view?: string) {
  await page.goto(view ? `${path}?software-view=${view}` : path);
  await expect(
    page.getByRole("heading", { name: "Open-Source Software" }),
  ).toBeVisible();
}

for (const renderPath of renderPaths) {
  test(`${renderPath.name} renders the project grid, optional fields, and totals`, async ({
    page,
  }) => {
    await openSoftware(page, renderPath.path);

    await expect(
      page.getByLabel("Software projects").getByRole("article"),
    ).toHaveCount(72);
    await expect(
      page.getByLabel("Software statistics").getByText("72", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Software statistics").getByText("187,998"),
    ).toBeVisible();
    await expect(
      page.getByLabel("Software statistics").getByText("7,105"),
    ).toBeVisible();

    const projectWithLogo = page.getByRole("article").filter({
      has: page.getByRole("heading", {
        name: "Python Tools for Working with Data",
      }),
    });
    await expect(
      projectWithLogo.getByRole("img", {
        name: "Python Tools for Working with Data logo",
      }),
    ).toBeVisible();
    await expect(
      projectWithLogo.getByRole("link", { name: "Documentation" }),
    ).toHaveAttribute("href", /data-code/);

    const projectWithoutOptionals = page.getByRole("article").filter({
      has: page.getByRole("heading", {
        name: "Github Actions Python Project Version",
      }),
    });
    await expect(projectWithoutOptionals.getByRole("img")).toHaveCount(0);
    await expect(
      projectWithoutOptionals.getByRole("link", { name: "Documentation" }),
    ).toHaveCount(0);
    await expect(
      projectWithoutOptionals.getByRole("link", { name: "Repository" }),
    ).toBeVisible();
  });

  test(`${renderPath.name} exposes loading, empty, and error states`, async ({
    page,
  }) => {
    await openSoftware(page, renderPath.path, "loading");
    await expect(page.getByRole("status")).toHaveText(
      "Loading software projects…",
    );
    await expect(page.getByLabel("Software projects")).toHaveCount(0);

    await openSoftware(page, renderPath.path, "empty");
    await expect(page.getByRole("status")).toContainText(
      "No software projects to show",
    );
    await expect(page.getByRole("article")).toHaveCount(0);

    await openSoftware(page, renderPath.path, "error");
    await expect(page.getByRole("alert")).toContainText(
      "Software projects are unavailable",
    );
    await expect(page.getByRole("article")).toHaveCount(0);
  });

  test(`${renderPath.name} project grid responds from mobile through desktop`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openSoftware(page, renderPath.path);
    await expect(page.getByLabel("Software projects")).toHaveCSS(
      "grid-template-columns",
      /\d+px/,
    );
    const mobileColumns = await page
      .getByLabel("Software projects")
      .evaluate(
        (element) =>
          getComputedStyle(element).gridTemplateColumns.split(" ").length,
      );
    expect(mobileColumns).toBe(1);

    await page.setViewportSize({ width: 800, height: 900 });
    const tabletColumns = await page
      .getByLabel("Software projects")
      .evaluate(
        (element) =>
          getComputedStyle(element).gridTemplateColumns.split(" ").length,
      );
    expect(tabletColumns).toBe(2);

    await page.setViewportSize({ width: 1280, height: 900 });
    const desktopColumns = await page
      .getByLabel("Software projects")
      .evaluate(
        (element) =>
          getComputedStyle(element).gridTemplateColumns.split(" ").length,
      );
    expect(desktopColumns).toBe(3);
  });
}
