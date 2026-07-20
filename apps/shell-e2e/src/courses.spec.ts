import { expect, type Page, test } from "@playwright/test";

const renderPaths = [
  { name: "host-composed", path: "courses" },
  { name: "standalone remote", path: "remotes/courses/" },
] as const;

async function openCourses(page: Page, path: string, view?: string) {
  await page.goto(view ? `${path}?courses-view=${view}` : path);
  await expect(
    page.getByRole("heading", { name: "Courses", exact: true }),
  ).toBeVisible();
}

for (const renderPath of renderPaths) {
  test(`${renderPath.name} renders the course list and topics from CV data`, async ({
    page,
  }) => {
    await openCourses(page, renderPath.path);

    await expect(
      page.getByLabel("Course list").getByRole("article"),
    ).toHaveCount(3);
    const financialModeling = page.getByRole("article").filter({
      has: page.getByRole("heading", { name: "Financial Modeling" }),
    });
    await expect(financialModeling.getByText("FIN 4934")).toBeVisible();
    await expect(
      financialModeling.getByLabel("Periods taught").getByRole("listitem"),
    ).toHaveCount(3);
    await expect(financialModeling.getByText(/^4.5 \/ 5$/)).toBeVisible();
    await expect(
      financialModeling.getByText("University of Florida", { exact: true }),
    ).toBeVisible();
    await expect(
      financialModeling
        .getByLabel("Financial Modeling topics")
        .getByRole("listitem"),
    ).toHaveText(["Introduction to Financial Modeling", "Corporate Valuation"]);
  });

  test(`${renderPath.name} distinguishes full and sparse course details`, async ({
    page,
  }) => {
    await openCourses(page, renderPath.path);

    const fullCourse = page.getByRole("article").filter({
      has: page.getByRole("heading", { name: "Financial Modeling" }),
    });
    await fullCourse.getByText("Explore Financial Modeling details").click();
    await expect(
      fullCourse.getByRole("heading", { name: "Textbook" }),
    ).toBeVisible();
    await expect(
      fullCourse.getByRole("heading", { name: "Prerequisites" }),
    ).toBeVisible();
    await expect(
      fullCourse.getByRole("heading", { name: "Grading" }),
    ).toBeVisible();
    await expect(
      fullCourse.getByRole("heading", { name: "Resources" }),
    ).toBeVisible();
    await expect(
      fullCourse.getByRole("link", { name: "Python from Scratch" }),
    ).toHaveAttribute("href", /waterloo/);

    const sparseCourse = page.getByRole("article").filter({
      has: page.getByRole("heading", { name: "Financial Management Lab" }),
    });
    await expect(sparseCourse.getByText("Spring 2014")).toBeVisible();
    await expect(
      sparseCourse.getByText("Virginia Commonwealth University", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(sparseCourse.getByText("Evaluation score")).toHaveCount(0);
    await expect(sparseCourse.getByText(/Explore .* details/)).toHaveCount(0);
    await expect(
      sparseCourse.getByLabel("Financial Management Lab topics"),
    ).toContainText("Excel");
  });

  test(`${renderPath.name} exposes loading, empty, and error states`, async ({
    page,
  }) => {
    await openCourses(page, renderPath.path, "loading");
    await expect(page.getByRole("status")).toHaveText("Loading courses…");

    await openCourses(page, renderPath.path, "empty");
    await expect(page.getByRole("status")).toContainText("No courses to show");
    await expect(page.getByRole("article")).toHaveCount(0);

    await openCourses(page, renderPath.path, "error");
    await expect(page.getByRole("alert")).toContainText(
      "Courses are unavailable",
    );
    await expect(page.getByRole("article")).toHaveCount(0);
  });

  test(`${renderPath.name} course panes respond from mobile through desktop`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openCourses(page, renderPath.path);
    const summary = page
      .getByRole("article")
      .first()
      .locator(".course-summary");
    const mobileColumns = await summary.evaluate(
      (element) =>
        getComputedStyle(element).gridTemplateColumns.split(" ").length,
    );
    expect(mobileColumns).toBe(1);

    await page.setViewportSize({ width: 800, height: 900 });
    const tabletColumns = await summary.evaluate(
      (element) =>
        getComputedStyle(element).gridTemplateColumns.split(" ").length,
    );
    expect(tabletColumns).toBe(2);

    await page.setViewportSize({ width: 1280, height: 900 });
    const desktopColumns = await summary.evaluate(
      (element) =>
        getComputedStyle(element).gridTemplateColumns.split(" ").length,
    );
    expect(desktopColumns).toBe(2);
  });
}
