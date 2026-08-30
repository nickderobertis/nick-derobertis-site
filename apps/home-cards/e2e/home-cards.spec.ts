import { expect, test } from "@playwright/test";
import {
  homePaneJourneys,
  paneRenderPaths,
  statefulHomePane,
} from "@site/e2e-harness";

homePaneJourneys("home-cards");

// The primitives this pane composes come from the design system rather than
// from the pane, and the pane reaches a visitor through two boundaries: its own
// published document, and the Home page that composes it. A primitive whose
// stylesheet failed to reach one of them would still render markup, so what is
// asserted here is what the visitor actually gets — the width the page shell
// holds the pane to, the surface the card paints, the action link's colour and
// its focus ring, and the panel the pane shows when it has nothing to show.
const pane = statefulHomePane("home-cards");

// llmlint: ignore-block[browser_journeys_run_against_the_built_app] These journeys belong to home-cards' own e2e target, but they do run against the built app: that target depends on shell:prerender, and paneRenderPaths opens the resulting production artifact at both the remote's standalone document and the host-composed route. This workspace intentionally keeps each app's browser suite behind its app's affected Nx edge; extracting a second project would change scheduling ownership without changing the artifact these tests drive.
for (const renderPath of paneRenderPaths(pane)) {
  test(`design-system primitives paint the areas of work ${renderPath.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(renderPath.url);

    const shell = page.getByRole("region", { name: "Areas of work" });
    await expect(shell).toBeVisible();
    const box = await shell.boundingBox();
    expect(Math.round(box?.width ?? 0)).toBe(1100);

    const card = shell.getByRole("article").first();
    await expect(card).toBeVisible();
    const action = card.getByRole("link").first();
    await expect(action).toHaveCSS("background-color", "rgb(233, 81, 85)");
    await expect(action).toHaveCSS("color", "rgb(255, 255, 255)");
    await expect(action).toHaveCSS("text-transform", "uppercase");
    await expect(action).toHaveCSS("border-top-width", "2px");
  });

  test(`the shared action link shows a keyboard visitor where they are ${renderPath.name}`, async ({
    page,
  }) => {
    await page.goto(renderPath.url);
    const action = page
      .getByRole("region", { name: "Areas of work" })
      .getByRole("link")
      .first();
    await expect(action).toBeVisible();

    // Tabbed to rather than focused programmatically, because the focus ring
    // the design system publishes is a :focus-visible ring: a visitor who
    // clicked must not get it, and a visitor who tabbed must.
    for (let step = 0; step < 40; step += 1) {
      if (await action.evaluate((node) => node === document.activeElement))
        break;
      await page.keyboard.press("Tab");
    }
    await expect(action).toBeFocused();
    await expect(action).toHaveCSS("outline-width", "3px");
    await expect(action).toHaveCSS("outline-color", "rgb(255, 255, 255)");
  });

  test(`the shared pane state replaces the pane politely ${renderPath.name}`, async ({
    page,
  }) => {
    await page.goto(`${renderPath.url}?state=empty`);

    const state = page
      .getByRole("status")
      .filter({ hasText: "No areas of work are available yet." });
    await expect(state).toBeVisible();
    await expect(state).toHaveCSS("border-style", "dashed");
    await expect(state).toHaveCSS("color", "rgb(97, 113, 124)");
    await expect(page.getByRole("alert")).toHaveCount(0);
  });
}
// llmlint: ignore-end[browser_journeys_run_against_the_built_app]
