import { expect, test } from "@playwright/test";
import {
  homePaneJourneys,
  paneRenderPaths,
  statefulHomePane,
} from "@site/e2e-harness";

homePaneJourneys("home-story");

// The shared section heading opens this pane: an eyebrow, the title the pane is
// named by, and the sentence under it. It is asserted through both boundaries
// because the heading is what the pane's own `aria-labelledby` points at, so a
// heading that arrived unstyled or unnamed through one of them would take the
// pane's accessible name with it.
const pane = statefulHomePane("home-story");

for (const renderPath of paneRenderPaths(pane)) {
  test(`the shared section heading opens the story ${renderPath.name}`, async ({
    page,
  }) => {
    await page.goto(renderPath.url);

    const title = page.getByRole("heading", { name: "Who am I?" });
    await expect(title).toBeVisible();
    await expect(title).toHaveCSS("font-family", "Georgia, serif");
    await expect(title).toHaveCSS("color", "rgb(18, 50, 74)");

    // The eyebrow and the description are the heading's own parts, so both are
    // read out of the header the title sits in rather than off the page.
    const heading = page.locator("header").filter({ has: title });
    await expect(heading.getByText("My story")).toBeVisible();
    await expect(
      heading.getByText(
        "I am a finance Ph.D., serial entrepreneur, engineer, and product leader.",
        { exact: false },
      ),
    ).toBeVisible();
  });
}
