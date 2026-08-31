import { expect, test } from "@playwright/test";
import { heldRemoteCodeHeader, holdRemoteCodeQuery } from "@site/e2e-fixtures";
import { remoteContract, remoteOwnershipTests } from "@site/e2e-harness";

const contract = remoteContract("home");

remoteOwnershipTests("home", { includeStandaloneLoading: false });

test("shows its skeleton while loading through its standalone boundary", async ({
  page,
}) => {
  let heldPageCode = 0;
  page.on("response", (response) => {
    if (response.headers()[heldRemoteCodeHeader] === "home") heldPageCode += 1;
  });
  const query = new URLSearchParams({
    "client-render": "1",
    [holdRemoteCodeQuery]: "home",
  });
  await page.goto(`${contract.standalone}?${query}`, {
    waitUntil: "domcontentloaded",
  });
  await expect(
    page.getByRole("status", { name: contract.loadingName, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole(contract.role, { name: contract.name, exact: true }),
  ).toBeVisible();
  expect(heldPageCode).toBeGreaterThan(0);
  await expect(
    page.getByRole("status", { name: contract.loadingName, exact: true }),
  ).toBeHidden();
});
