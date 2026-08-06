import { basename } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { isEagerRemoteAsset } from "@site/e2e-fixtures";
import { homePanes, type RemoteName, remoteContract } from "./site-contract.ts";

/**
 * Holds one remote's lazily loaded page code until the caller releases it, and
 * reports how many requests it held.
 *
 * A pane Home composes reaches its skeleton through a client navigation, and
 * Home warms every pane on the same hover that starts that navigation. The
 * skeleton is therefore on screen only until whichever of the two finishes
 * first, and on a busy machine the warm wins: the pane mounts already resolved
 * and the skeleton is never rendered. Holding its page code moves that window
 * into the journey's own hands. The remote's entry and its eagerly served
 * skeleton are deliberately not held — the fallback has to be able to render.
 */
async function holdPageCode(page: Page, name: RemoteName) {
  let release = (): void => undefined;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  let held = 0;
  await page.route(
    (url) =>
      url.pathname.includes(`/remotes/${name}/`) &&
      url.pathname.endsWith(".js") &&
      !isEagerRemoteAsset(basename(url.pathname)),
    async (route) => {
      held += 1;
      await released;
      await route.continue();
    },
  );
  return { release: () => release(), held: () => held };
}

/**
 * Registers the ownership journeys one remote owns: it renders through its
 * standalone and host-composed boundaries, and it shows its own skeleton while
 * its page resolves. The contract comes from the shared site contract, so an
 * app declares only which remote it owns.
 */
export function remoteOwnershipTests(name: RemoteName): void {
  const contract = remoteContract(name);
  for (const [render, route] of [
    ["host-composed", contract.host],
    ["standalone", contract.standalone],
  ] as const)
    test(`renders through its ${render} boundary`, async ({ page }) => {
      const failures: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error")
          failures.push(`console: ${message.text()}`);
      });
      page.on("pageerror", (error) => failures.push(`page: ${error.message}`));
      page.on("response", (response) => {
        if (response.status() >= 400)
          failures.push(`${response.status()} ${response.url()}`);
      });
      await page.goto(route);
      await expect(
        page.getByRole(contract.role, { name: contract.name, exact: true }),
      ).toBeVisible();
      expect(failures).toEqual([]);
    });

  // A pane Home composes reaches its host-composed skeleton through a client
  // navigation to Home; every other remote needs its route's loading query.
  const nestedHomeOwner = homePanes().some((pane) => pane.remote === name);
  const loadingBoundaries =
    nestedHomeOwner || contract.loadingQuery
      ? (["host-composed", "standalone"] as const)
      : (["standalone"] as const);

  for (const render of loadingBoundaries)
    test(`shows its skeleton while loading through its ${render} boundary`, async ({
      page,
    }) => {
      // Only the navigated pane route races the warm; the loading queries and
      // the standalone documents hold their own boundary open.
      const nested =
        render === "host-composed" && !contract.loadingQuery
          ? await holdPageCode(page, name)
          : undefined;
      if (render === "host-composed") {
        if (contract.loadingQuery)
          await page.goto(`${contract.host}?${contract.loadingQuery}`, {
            waitUntil: "domcontentloaded",
          });
        else {
          await page.goto("bio");
          await page.getByRole("link", { name: "Home", exact: true }).click();
        }
      } else
        await page.goto(`${contract.standalone}?client-render=1`, {
          waitUntil: "domcontentloaded",
        });
      await expect(
        page.getByRole("status", {
          name: contract.loadingName,
          exact: true,
        }),
      ).toBeVisible();
      nested?.release();
      await expect(
        page.getByRole(contract.role, { name: contract.name, exact: true }),
      ).toBeVisible();
      // A renamed chunk would hold nothing and quietly put this journey back on
      // the server's timer, so the hold has to have caught the pane's code.
      if (nested) expect(nested.held()).toBeGreaterThan(0);
      await expect(
        page.getByRole("status", {
          name: contract.loadingName,
          exact: true,
        }),
      ).toBeHidden();
    });
}
