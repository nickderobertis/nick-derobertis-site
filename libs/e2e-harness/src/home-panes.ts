import { expect, test } from "@playwright/test";
import {
  type RemoteContract,
  type StatefulPaneRemote,
  statefulHomePane,
} from "./site-contract.ts";

/**
 * Both boundaries every Home pane renders through: its own published document,
 * and the Home page that composes it.
 */
export function paneRenderPaths(pane: RemoteContract) {
  return [
    { name: "standalone", url: pane.standalone },
    { name: "host-composed", url: pane.host },
  ] as const;
}

const viewports = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

/**
 * Registers the journeys one Home pane owns: its happy path, its skeleton, its
 * empty and error states, and its layout at each breakpoint, through both of
 * its render paths.
 */
export function homePaneJourneys(remote: StatefulPaneRemote): void {
  const pane = statefulHomePane(remote);
  for (const path of paneRenderPaths(pane)) {
    test(`${remote} happy path is accessible ${path.name}`, async ({
      page,
    }) => {
      await page.goto(path.url);
      await expect(
        page.getByRole(pane.role, { name: pane.name }),
      ).toBeVisible();
    });

    test(`${remote} loading state shows its skeleton ${path.name}`, async ({
      page,
    }) => {
      await page.goto(`${path.url}?state=loading`);
      await expect(
        page.getByRole("status", { name: pane.loadingName, exact: true }),
      ).toBeVisible();
    });

    for (const [state, message] of Object.entries(pane.states))
      test(`${remote} ${state} state is visible ${path.name}`, async ({
        page,
      }) => {
        await page.goto(`${path.url}?state=${state}`);
        await expect(
          page.getByRole("status").filter({ hasText: message }),
        ).toBeVisible();
      });

    for (const viewport of viewports)
      test(`${remote} fits the ${viewport.name} breakpoint ${path.name}`, async ({
        page,
      }) => {
        await page.setViewportSize(viewport);
        await page.goto(path.url);
        const locator = page.getByRole(pane.role, { name: pane.name });
        await expect(locator).toBeVisible();
        const box = await locator.boundingBox();
        expect(box?.x).toBeGreaterThanOrEqual(0);
        expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(
          viewport.width + 1,
        );
      });
  }
}
