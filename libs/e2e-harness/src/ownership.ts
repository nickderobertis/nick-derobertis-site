import { expect, type Page, test } from "@playwright/test";

export type RemoteContract = {
  host: string;
  standalone: string;
  role: string;
  name: string;
  loadingName: string;
  loadingQuery?: string;
};

export function remoteOwnershipTests(contract: RemoteContract): void {
  const role = contract.role as Parameters<Page["getByRole"]>[0];
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
        page.getByRole(role, { name: contract.name, exact: true }),
      ).toBeVisible();
      expect(failures).toEqual([]);
    });

  const nestedHomeOwner = [
    "timeline",
    "awards",
    "skills",
    "home-carousel",
    "home-cards",
    "home-story",
    "home-contact",
  ].some((name) => contract.standalone === `remotes/${name}/`);
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
        page.getByRole(role, { name: contract.name, exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("status", {
          name: contract.loadingName,
          exact: true,
        }),
      ).toBeHidden();
    });
}
