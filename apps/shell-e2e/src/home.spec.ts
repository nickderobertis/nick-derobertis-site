import { expect, test } from "@playwright/test";

const panes = [
  {
    remote: "home-carousel",
    happy: { role: "region" as const, name: "Featured work" },
    states: {
      empty: "No featured stories are available yet.",
      loading: "Loading featured stories…",
      error: "Featured stories could not be loaded.",
    },
  },
  {
    remote: "home-cards",
    happy: { role: "region" as const, name: "Areas of work" },
    states: {
      empty: "No areas of work are available yet.",
      loading: "Loading areas of work…",
      error: "Areas of work could not be loaded.",
    },
  },
  {
    remote: "home-story",
    happy: { role: "heading" as const, name: "Who am I?" },
    states: {
      empty: "No story is available yet.",
      loading: "Loading Nick’s story…",
      error: "Nick’s story could not be loaded.",
    },
  },
  {
    remote: "home-contact",
    happy: {
      role: "heading" as const,
      name: "Let’s build something useful.",
    },
    states: {
      empty: "No contact options are available.",
      loading: "Loading contact options…",
      error: "Contact options could not be loaded.",
    },
  },
] as const;

const renderPaths = [
  { name: "standalone", url: (remote: string) => `remotes/${remote}/` },
  { name: "host-composed", url: () => "" },
] as const;

for (const pane of panes) {
  for (const path of renderPaths) {
    test(`${pane.remote} happy path is accessible ${path.name}`, async ({
      page,
    }) => {
      await page.goto(path.url(pane.remote));
      await expect(
        page.getByRole(pane.happy.role, { name: pane.happy.name }),
      ).toBeVisible();
    });

    for (const [state, message] of Object.entries(pane.states))
      test(`${pane.remote} ${state} state is visible ${path.name}`, async ({
        page,
      }) => {
        await page.goto(`${path.url(pane.remote)}?state=${state}`);
        await expect(
          page.getByRole("status").filter({ hasText: message }),
        ).toBeVisible();
      });
  }
}

for (const path of renderPaths)
  test(`HOME composition loads all pane boundaries ${path.name}`, async ({
    page,
  }) => {
    await page.goto(path.name === "standalone" ? "remotes/home/" : "");
    await expect(
      page.getByRole("region", { name: "Featured work" }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Areas of work" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Who am I?" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Let’s build something useful." }),
    ).toBeVisible();
  });

for (const path of renderPaths)
  for (const state of ["empty", "loading", "error"] as const)
    test(`HOME composition exposes its ${state} state ${path.name}`, async ({
      page,
    }) => {
      const url = path.name === "standalone" ? "remotes/home/" : "";
      await page.goto(`${url}?state=${state}`);
      await expect(page.getByRole("status")).toHaveCount(4);
      for (const pane of panes)
        await expect(
          page.getByRole("status").filter({ hasText: pane.states[state] }),
        ).toBeVisible();
    });

const viewports = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

for (const pane of panes)
  for (const viewport of viewports)
    for (const path of renderPaths)
      test(`${pane.remote} fits the ${viewport.name} breakpoint ${path.name}`, async ({
        page,
      }) => {
        await page.setViewportSize(viewport);
        await page.goto(path.url(pane.remote));
        const locator = page.getByRole(pane.happy.role, {
          name: pane.happy.name,
        });
        await expect(locator).toBeVisible();
        const box = await locator.boundingBox();
        expect(box?.x).toBeGreaterThanOrEqual(0);
        expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(
          viewport.width + 1,
        );
      });

test("carousel rotates automatically in its standalone remote", async ({
  page,
}) => {
  await page.goto("remotes/home-carousel/");
  await expect(
    page.getByRole("heading", { name: "Finance researcher & educator" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Serial founder & full-stack software engineer",
    }),
  ).toBeVisible({ timeout: 6500 });
});

test("carousel controls rotate with keyboard in the host", async ({ page }) => {
  await page.goto("");
  await page.getByRole("button", { name: "Next featured story" }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", {
      name: "Serial founder & full-stack software engineer",
    }),
  ).toBeVisible();
  await expect(page.getByText("Story 2 of 2")).toBeVisible();
});
