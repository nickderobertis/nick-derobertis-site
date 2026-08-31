import { expect, test } from "@playwright/test";
import { heldRemoteCodeHeader, holdRemoteCodeQuery } from "@site/e2e-fixtures";
import { remoteContract } from "@site/e2e-harness";

const contract = remoteContract("home");

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
