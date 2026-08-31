import { expect, type Page, test } from "@playwright/test";
import { heldRemoteCodeHeader, holdRemoteCodeQuery } from "@site/e2e-fixtures";
import { homePanes, type RemoteName, remoteContract } from "./site-contract.ts";

/**
 * Counts the responses the site server held back as one remote's lazily loaded
 * page code, read off the responses this journey already watches.
 *
 * A pane Home composes reaches its skeleton through a client navigation, and
 * Home warms every pane on the same hover that starts that navigation. The
 * skeleton is therefore on screen only until whichever of the two finishes
 * first, and on a busy machine the warm wins: the pane mounts already resolved
 * and the skeleton is never rendered. Naming the pane's remote in the document
 * this journey navigates to holds that page code on the server for the whole
 * journey instead. The remote's entry and its eagerly served skeleton are
 * deliberately not held — the fallback has to be able to render.
 */
function countHeldPageCode(page: Page, name: RemoteName) {
  let held = 0;
  page.on("response", (response) => {
    if (response.headers()[heldRemoteCodeHeader] === name) held += 1;
  });
  return () => held;
}

interface RemoteOwnershipOptions {
  holdStandalonePageCode?: boolean;
}

/**
 * Registers the ownership journeys one remote owns: it renders through its
 * standalone and host-composed boundaries, and it shows its own skeleton while
 * its page resolves. The contract comes from the shared site contract, so an
 * app declares only which remote it owns.
 */
export function remoteOwnershipTests(
  name: RemoteName,
  { holdStandalonePageCode = false }: RemoteOwnershipOptions = {},
): void {
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

  // llmlint: ignore-block[tests_mirror_real_usage] The fixture delays only the arrival of the real built page chunk and substitutes nothing, while every navigation remains a real navigation against the built artifact. The held-response assertion is necessary because a renamed chunk would hold nothing and silently return the journey to ordinary latency; it proves the fixture caught this pane's real code while the user-facing skeleton was visible, before the heading appeared and the skeleton went away.
  for (const render of loadingBoundaries)
    test(`shows its skeleton while loading through its ${render} boundary`, async ({
      page,
    }) => {
      // Only the navigated pane route races the warm; the loading queries and
      // the standalone documents hold their own boundary open.
      const heldPageCode =
        (render === "host-composed" && !contract.loadingQuery) ||
        (render === "standalone" && holdStandalonePageCode)
          ? countHeldPageCode(page, name)
          : undefined;
      if (render === "host-composed") {
        if (contract.loadingQuery)
          await page.goto(`${contract.host}?${contract.loadingQuery}`, {
            waitUntil: "domcontentloaded",
          });
        else {
          // The document this journey starts from arms the hold, and the client
          // navigation that follows keeps it, so the pane's page code is still
          // in flight when Home mounts.
          await page.goto(`bio?${holdRemoteCodeQuery}=${name}`);
          await page.getByRole("link", { name: "Home", exact: true }).click();
        }
      } else {
        const query = new URLSearchParams({ "client-render": "1" });
        // llmlint: ignore[e2e_not_mocked,tests_mirror_real_usage] This is the fixture server's established deterministic remote-code hold, already used above for the host-composed journey: it serves the real built page chunk unchanged after holding only its arrival, while the browser performs a real standalone navigation. The held-response header assertion below proves that actual page code remained in flight when the accessible skeleton appeared, a timing state ordinary local navigation cannot expose reliably.
        if (holdStandalonePageCode) query.set(holdRemoteCodeQuery, name);
        await page.goto(`${contract.standalone}?${query}`, {
          waitUntil: "domcontentloaded",
        });
      }
      await expect(
        page.getByRole("status", {
          name: contract.loadingName,
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole(contract.role, { name: contract.name, exact: true }),
      ).toBeVisible();
      // A renamed chunk would hold nothing and quietly put this journey back on
      // the server's ordinary latency, so the hold has to have caught the pane's
      // code.
      if (heldPageCode) expect(heldPageCode()).toBeGreaterThan(0);
      await expect(
        page.getByRole("status", {
          name: contract.loadingName,
          exact: true,
        }),
      ).toBeHidden();
    });
  // llmlint: ignore-end[tests_mirror_real_usage]
}
