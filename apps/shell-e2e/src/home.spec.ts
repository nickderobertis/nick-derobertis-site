import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
    await expect(
      page.getByRole("region", { name: "Timeline visualization" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Selected awards" }),
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

for (const path of renderPaths)
  for (const state of ["empty", "loading", "error"] as const)
    test(`HOME composition exposes the timeline ${state} state ${path.name}`, async ({
      page,
    }) => {
      const url = path.name === "standalone" ? "remotes/home/" : "";
      await page.goto(`${url}?timeline-state=${state}`);
      const role = state === "error" ? "alert" : "status";
      const message =
        state === "empty"
          ? "No education or employment entries are available."
          : state === "loading"
            ? "Loading timeline…"
            : "Timeline unavailable";
      await expect(
        page.getByRole(role).filter({ hasText: message }),
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

for (const path of renderPaths) {
  test(`carousel rotates automatically ${path.name}`, async ({ page }) => {
    await page.goto(path.url("home-carousel"));
    await expect(
      page.getByRole("heading", { name: "Finance researcher & educator" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "Serial founder & full-stack software engineer",
      }),
    ).toBeVisible({ timeout: 6500 });
  });
  test(`carousel controls rotate with keyboard ${path.name}`, async ({
    page,
  }) => {
    await page.goto(path.url("home-carousel"));
    await page.getByRole("button", { name: "Next featured story" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText("Story 2 of 2")).toBeVisible();
  });
}

for (const path of renderPaths) {
  test(`HOME action links navigate ${path.name}`, async ({ page }) => {
    const internalLinks = [
      ["View research", "/research"],
      ["View software", "/software"],
      ["View courses", "/courses"],
      ["View bio", "/bio"],
    ] as const;
    for (const [name, destination] of internalLinks) {
      await page.goto(path.url("home"));
      await page.getByRole("link", { name, exact: true }).first().click();
      await expect(page).toHaveURL(new RegExp(`${destination}$`));
    }
    await page.goto(path.url("home"));
    await expect(
      page.getByRole("link", { name: "Email Nick" }),
    ).toHaveAttribute("href", "mailto:derobertis.nick@gmail.com");
    await expect(page.getByRole("link", { name: "LinkedIn" })).toHaveAttribute(
      "href",
      "https://www.linkedin.com/in/nickderobertis/",
    );
    await expect(page.getByRole("link", { name: "GitHub" })).toHaveAttribute(
      "href",
      "https://github.com/nickderobertis",
    );
  });
}

test("script entry points reject invalid inputs with recovery actions", async () => {
  const invalidPort = spawnSync(process.execPath, ["scripts/serve-e2e.mjs"], {
    env: { ...process.env, PORT: "invalid" },
    encoding: "utf8",
  });
  expect(invalidPort.status).not.toBe(0);
  expect(invalidPort.stderr).toContain("run just test-e2e again");
  const occupiedServer = createServer();
  await new Promise<void>((resolve) =>
    occupiedServer.listen(0, "127.0.0.1", resolve),
  );
  const address = occupiedServer.address();
  if (address === null || typeof address === "string")
    throw new Error("Expected a TCP address for the occupied test port");
  const occupiedPort = spawnSync(process.execPath, ["scripts/serve-e2e.mjs"], {
    env: { ...process.env, PORT: String(address.port) },
    encoding: "utf8",
  });
  occupiedServer.close();
  expect(occupiedPort.status).not.toBe(0);
  expect(occupiedPort.stderr).toContain("Choose an available PORT");
  const fixture = await mkdtemp(join(tmpdir(), "site-prerender-"));
  try {
    const output = join(fixture, "output");
    const builds = join(fixture, "builds");
    await mkdir(output);
    await mkdir(builds);
    await cp("dist/apps/shell/index.html", join(output, "index.html"));
    const missing = spawnSync(process.execPath, ["scripts/prerender.mjs"], {
      env: {
        ...process.env,
        PRERENDER_OUTPUT: output,
        REMOTE_BUILD_ROOT: builds,
      },
      encoding: "utf8",
    });
    expect(missing.status).not.toBe(0);
    expect(missing.stderr).toContain("Run just check");
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});
