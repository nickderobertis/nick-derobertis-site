import { expect, test } from "@playwright/test";
import {
  homePaneJourneys,
  paneRenderPaths,
  remoteContract,
} from "@site/e2e-harness";

homePaneJourneys("home-carousel");

const carousel = remoteContract("home-carousel");

for (const path of paneRenderPaths(carousel)) {
  test(`carousel rotates automatically ${path.name}`, async ({ page }) => {
    await page.goto(path.url);
    await expect(
      page.getByRole("heading", { name: "Finance researcher & educator" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "Serial founder & full-stack software engineer",
      }),
    ).toBeVisible({ timeout: 6500 });
  });

  test(`carousel controls rotate with keyboard ${path.name}`, async ({
    page,
  }) => {
    await page.goto(path.url);
    await page.getByRole("button", { name: "Next featured story" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText("Story 2 of 2")).toBeVisible();
  });
}
