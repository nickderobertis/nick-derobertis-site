import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { homePanes, paneRenderPaths, remoteContract } from "@site/e2e-harness";

// Home owns the composed page: every pane it composes is asserted here through
// both render paths, while each pane owns its own states in its own suite.
const panes = homePanes();
const statefulPanes = panes.flatMap((pane) =>
  pane.states ? [{ ...pane, states: pane.states }] : [],
);
const renderPaths = paneRenderPaths(remoteContract("home"));

for (const path of renderPaths)
  test(`HOME composition loads all pane boundaries ${path.name}`, async ({
    page,
  }) => {
    await page.goto(path.url);
    for (const pane of panes)
      await expect(
        page.getByRole(pane.role, { name: pane.name }),
        pane.remote,
      ).toBeVisible();
  });

for (const path of renderPaths)
  for (const state of ["empty", "loading", "error"] as const)
    test(`HOME composition exposes its ${state} state ${path.name}`, async ({
      page,
    }) => {
      await page.goto(`${path.url}?state=${state}`);
      await expect(page.getByRole("status")).toHaveCount(statefulPanes.length);
      for (const pane of statefulPanes)
        if (state === "loading")
          await expect(
            page.getByRole("status", { name: pane.loadingName, exact: true }),
          ).toBeVisible();
        else
          await expect(
            page.getByRole("status").filter({ hasText: pane.states[state] }),
          ).toBeVisible();
    });

for (const path of renderPaths)
  for (const state of ["empty", "loading", "error"] as const)
    test(`HOME composition exposes the timeline ${state} state ${path.name}`, async ({
      page,
    }) => {
      await page.goto(`${path.url}?timeline-state=${state}`);
      if (state === "loading") {
        await expect(
          page.getByRole("status", { name: "Loading timeline", exact: true }),
        ).toBeVisible();
        return;
      }
      const role = state === "error" ? "alert" : "status";
      const message =
        state === "empty"
          ? "No education or employment entries are available."
          : "Timeline unavailable";
      await expect(
        page.getByRole(role).filter({ hasText: message }),
      ).toBeVisible();
    });

for (const path of renderPaths) {
  test(`HOME action links navigate ${path.name}`, async ({ page }) => {
    const internalLinks = [
      ["View research", "/research"],
      ["View software", "/software"],
      ["View courses", "/courses"],
      ["View bio", "/bio"],
    ] as const;
    for (const [name, destination] of internalLinks) {
      await page.goto(path.url);
      await page.getByRole("link", { name, exact: true }).first().click();
      await expect(page).toHaveURL(new RegExp(`${destination}$`));
    }
    await page.goto(path.url);
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
  const invalidPort = spawnSync(
    process.execPath,
    ["scripts/serve/serve-e2e.mjs"],
    {
      env: { ...process.env, PORT: "invalid" },
      encoding: "utf8",
    },
  );
  expect(invalidPort.status).not.toBe(0);
  expect(invalidPort.stderr).toContain("run just test-e2e again");
  const occupiedServer = createServer();
  await new Promise<void>((resolve) =>
    occupiedServer.listen(0, "127.0.0.1", resolve),
  );
  const address = occupiedServer.address();
  if (address === null || typeof address === "string")
    throw new Error("Expected a TCP address for the occupied test port");
  const occupiedPort = spawnSync(
    process.execPath,
    ["scripts/serve/serve-e2e.mjs"],
    {
      env: { ...process.env, PORT: String(address.port) },
      encoding: "utf8",
    },
  );
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
    const missing = spawnSync(
      process.execPath,
      ["scripts/compose/compose.mjs"],
      {
        env: {
          ...process.env,
          COMPOSE_OUTPUT: output,
          FRAGMENT_ROOT: builds,
        },
        encoding: "utf8",
      },
    );
    expect(missing.status).not.toBe(0);
    expect(missing.stderr).toContain("Run just check");
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test("static routes tolerate malformed Referer headers", async ({
  request,
}) => {
  const response = await request.get("", {
    headers: { referer: "not a valid URL" },
  });
  expect(response.status()).toBe(200);
  await expect(response.text()).resolves.toContain("<html");
});
