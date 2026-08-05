import { expect, test } from "@playwright/test";
import { homePanes, type RemoteName, remoteContract } from "./site-contract.ts";

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
      await expect(
        page.getByRole(contract.role, { name: contract.name, exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("status", {
          name: contract.loadingName,
          exact: true,
        }),
      ).toBeHidden();
    });
}
