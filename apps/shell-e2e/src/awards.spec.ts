import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { createStaticSiteServer } from "@site/static-site-server";

const allAwardsPaths = [
  { name: "host-composed", path: "awards" },
  { name: "standalone remote", path: "remotes/awards/" },
] as const;
const selectedAwardsPaths = [
  { name: "home selected awards", path: "" },
  {
    name: "standalone selected awards",
    path: "remotes/awards/selected/",
  },
] as const;
const statePaths = [...selectedAwardsPaths, ...allAwardsPaths] as const;
const artifactPath = "cv-data/domains/awards.json";

async function withArtifactOutcome(
  outcome: "empty" | "error",
  run: (baseUrl: string, root: string) => Promise<void>,
) {
  const root = await mkdtemp(join(tmpdir(), "awards-e2e-"));
  await cp("dist/apps/shell", root, { recursive: true });
  const artifact = join(root, artifactPath);
  if (outcome === "empty") await writeFile(artifact, "[]");
  else await rm(artifact);
  const server = createStaticSiteServer(root);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  try {
    await run(`http://127.0.0.1:${address.port}/nick-derobertis-site/`, root);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await rm(root, { recursive: true });
  }
}

async function openAwards(page: Page, path: string) {
  await page.goto(path);
  await expect(
    page.getByRole("heading", { name: "Awards", exact: true }),
  ).toBeVisible();
}

for (const renderPath of selectedAwardsPaths) {
  test(`${renderPath.name} renders the data-access subset and stats`, async ({
    page,
  }) => {
    await openAwards(page, renderPath.path);
    await expect(
      page.getByLabel("Awards list").getByRole("article"),
    ).toHaveCount(4);
    await expect(
      page.getByLabel("Awards statistics").getByText("4", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Finance Student of the Year" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "Warrington Finance Ph.D. Research Grants",
      }),
    ).toHaveCount(0);
  });
}

for (const renderPath of allAwardsPaths) {
  test(`${renderPath.name} renders all awards, stats, extra info, and award parts`, async ({
    page,
  }) => {
    await openAwards(page, renderPath.path);
    await expect(
      page.getByLabel("Awards list").getByRole("article"),
    ).toHaveCount(7);
    await expect(
      page.getByLabel("Awards statistics").getByText("7", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Awards statistics").getByText("5", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Awards statistics").getByText("4", { exact: true }),
    ).toBeVisible();

    const withParts = page.getByRole("article").filter({
      has: page.getByRole("heading", {
        name: "Graduate Management Admission Test (GMAT) Score",
      }),
    });
    await expect(withParts.getByText("2014", { exact: true })).toBeVisible();
    await expect(
      withParts.getByRole("note", { name: "Award extra information" }),
    ).toHaveText("780");
    await expect(
      withParts.getByLabel("Award parts").getByRole("listitem"),
    ).toHaveCount(1);
    await expect(withParts.getByText("99.6 percentile")).toBeVisible();

    const extraInfoOnly = page.getByRole("article").filter({
      has: page.getByRole("heading", {
        name: "Warrington Finance Ph.D. Research Grants",
      }),
    });
    await expect(
      extraInfoOnly.getByRole("note", { name: "Award extra information" }),
    ).toHaveText("$2000/yr");
    await expect(extraInfoOnly.getByLabel("Award parts")).toHaveCount(0);

    const withoutInfo = page.getByRole("article").filter({
      has: page.getByRole("heading", { name: "Finance Student of the Year" }),
    });
    await expect(withoutInfo.getByText("2013", { exact: true })).toBeVisible();
    await expect(
      withoutInfo.getByRole("note", { name: "Award extra information" }),
    ).toHaveCount(0);
    await expect(withoutInfo.getByLabel("Award parts")).toHaveCount(0);
  });

  test(`${renderPath.name} awards grid responds from mobile through desktop`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openAwards(page, renderPath.path);
    const columns = () =>
      page
        .getByLabel("Awards list")
        .evaluate(
          (element) =>
            getComputedStyle(element).gridTemplateColumns.split(" ").length,
        );
    expect(await columns()).toBe(1);

    await page.setViewportSize({ width: 800, height: 900 });
    expect(await columns()).toBe(2);

    await page.setViewportSize({ width: 1280, height: 900 });
    expect(await columns()).toBe(3);
  });

  test(`${renderPath.name} matches the awards visual baseline`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 1600 });
    await openAwards(page, renderPath.path);
    await expect(page).toHaveScreenshot(
      `${renderPath.name.replace(" ", "-")}-awards.png`,
      { animations: "disabled", fullPage: true },
    );
  });
}

test("standalone selected awards responds from mobile through desktop", async ({
  page,
}) => {
  const path = "remotes/awards/selected/";
  await page.setViewportSize({ width: 390, height: 844 });
  await openAwards(page, path);
  const columns = () =>
    page
      .getByLabel("Awards list")
      .evaluate(
        (element) =>
          getComputedStyle(element).gridTemplateColumns.split(" ").length,
      );
  expect(await columns()).toBe(1);
  await page.setViewportSize({ width: 800, height: 900 });
  expect(await columns()).toBe(2);
  await page.setViewportSize({ width: 1280, height: 900 });
  expect(await columns()).toBe(3);
});

test("standalone selected awards matches its visual baseline", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1600 });
  await openAwards(page, "remotes/awards/selected/");
  await expect(page).toHaveScreenshot("standalone-selected-awards.png", {
    animations: "disabled",
    fullPage: true,
  });
});

for (const statePath of statePaths) {
  test(`${statePath.name} exposes a genuine slow-network loading state`, async ({
    page,
  }) => {
    const session = await page.context().newCDPSession(page);
    await session.send("Network.enable");
    await session.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 1_200,
      downloadThroughput: 500_000,
      uploadThroughput: 500_000,
    });
    await page.goto(statePath.path);
    await expect(page.getByRole("status")).toHaveText("Loading awards…");
    await expect(page.getByLabel("Awards list")).toBeVisible();
  });

  test(`${statePath.name} renders an actually empty awards artifact`, async ({
    page,
  }) => {
    await withArtifactOutcome("empty", async (baseUrl) => {
      await openAwards(page, `${baseUrl}${statePath.path}`);
      await expect(page.getByRole("status")).toContainText("No awards to show");
      await expect(
        page.getByRole("region", { name: "Awards" }).getByRole("article"),
      ).toHaveCount(0);
    });
  });

  test(`${statePath.name} recovers after a missing artifact is restored`, async ({
    page,
  }) => {
    await withArtifactOutcome("error", async (baseUrl, root) => {
      await openAwards(page, `${baseUrl}${statePath.path}`);
      await expect(page.getByRole("alert")).toContainText(
        "Awards are unavailable",
      );
      await cp(join("dist/apps/shell", artifactPath), join(root, artifactPath));
      await page.getByRole("button", { name: "Try again" }).click();
      await expect(page.getByLabel("Awards list")).toBeVisible();
    });
  });
}
