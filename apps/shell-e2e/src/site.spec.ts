import { readFileSync } from "node:fs";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { z } from "zod";

const pages = [
  {
    link: "Home",
    heading: "Finance researcher & educator",
    path: "",
  },
  {
    link: "Bio",
    heading: "Optimizing Life",
    path: "bio",
  },
  {
    link: "Research",
    heading: "Research Works",
    path: "research",
  },
  {
    link: "Software",
    heading: "Open-Source Software",
    path: "software",
  },
  {
    link: "Courses",
    heading: "Courses",
    path: "courses",
  },
];

for (const route of pages)
  test(`${route.link} direct route resolves all project-path assets`, async ({
    page,
  }) => {
    const failures: string[] = [];
    page.on("response", (response) => {
      if (response.status() >= 400)
        failures.push(`${response.status()} ${response.url()}`);
    });
    await page.goto(route.path);
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: route.heading }),
    ).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
    expect(failures).toEqual([]);
  });

test("every route has useful HTML with JavaScript disabled", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  for (const route of pages) {
    await page.goto(route.path);
    await expect(
      page.getByRole("heading", {
        name: route.heading,
      }),
    ).toBeVisible();
    await expect(page).toHaveTitle(/Nick DeRobertis/);
  }
  await context.close();
});

test("every prerendered route contains substantive feature content", async ({
  browser,
}) => {
  const expected = [
    ["", "Who am I?"],
    ["bio", "Reproducible Research"],
    ["research", "Valuation without Cash Flows"],
    ["software", "Python Tools for Working with Data"],
    ["courses", "Financial Modeling"],
  ] as const;
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  for (const [path, content] of expected) {
    await page.goto(path);
    await expect(
      page.getByText(content, { exact: false }).first(),
    ).toBeVisible();
  }
  await context.close();
});

interface StyleProbe {
  locate: (page: Page) => Locator;
  styles: Record<string, string>;
}

const routeManifestSchema = z.array(
  z.object({ path: z.string().regex(/^\/(?:[a-z][a-z0-9-]*)?$/) }),
);
const federationManifestSchema = z.object({
  remotes: z
    .array(
      z.object({
        entry: z.string().regex(/\/remotes\/[a-z][a-z0-9-]*\/remoteEntry\.js$/),
      }),
    )
    .nonempty(),
});

// The probes below have to cover every prerendered document, so both inventories
// come from the sources the artifact check gates rather than a third copy.
function prerenderedRoutePaths() {
  return routeManifestSchema
    .parse(JSON.parse(readFileSync("apps/shell/src/routes.json", "utf8")))
    .map(({ path }) => path.slice(1));
}

function homeComposedRemotes() {
  const manifest = federationManifestSchema.parse(
    JSON.parse(
      readFileSync("dist/apps/shell/remotes/home/mf-manifest.json", "utf8"),
    ),
  );
  return [
    ...new Set(
      manifest.remotes.map(({ entry }) =>
        z
          .string()
          .parse(
            /\/remotes\/([a-z][a-z0-9-]*)\/remoteEntry\.js$/.exec(entry)?.[1],
          ),
      ),
    ),
  ];
}

// Every probe pins a style that only the feature's own remote stylesheet
// declares, so it can pass only while that CSS reaches the browser without any
// federated JavaScript.
const routeStyling: (StyleProbe & { path: string })[] = [
  {
    path: "",
    locate: (page) =>
      page
        .getByRole("region", { name: "Areas of work" })
        .getByRole("article")
        .first(),
    styles: { "text-align": "center" },
  },
  {
    path: "bio",
    locate: (page) => page.getByRole("heading", { name: "Optimizing Life" }),
    styles: { "text-align": "center", "font-weight": "400" },
  },
  {
    path: "research",
    locate: (page) => page.getByRole("heading", { name: "Research Works" }),
    styles: { "font-family": "Georgia, serif", color: "rgb(255, 255, 255)" },
  },
  {
    path: "software",
    locate: (page) =>
      page
        .getByRole("img", { name: "Python Tools for Working with Data logo" })
        .first(),
    styles: { width: "40px", "flex-basis": "40px" },
  },
  {
    path: "courses",
    locate: (page) => page.getByRole("heading", { name: "Courses" }),
    styles: { "font-family": "Georgia, serif" },
  },
];

// Home composes these panes, so its document carries their CSS too; each pane
// also owns a standalone prerendered document that links the same stylesheet.
const paneStyling: (StyleProbe & { remote: string })[] = [
  {
    remote: "home-carousel",
    locate: (page) => page.getByRole("region", { name: "Featured work" }),
    styles: { display: "grid", color: "rgb(255, 255, 255)" },
  },
  {
    remote: "home-cards",
    locate: (page) => page.getByRole("region", { name: "Areas of work" }),
    styles: { display: "grid" },
  },
  {
    remote: "home-story",
    locate: (page) => page.getByRole("heading", { name: "Who am I?" }),
    styles: { "font-family": "Georgia, serif" },
  },
  {
    remote: "home-contact",
    locate: (page) =>
      page.getByRole("heading", { name: "Let’s build something useful." }),
    styles: { "font-family": "Georgia, serif" },
  },
  {
    remote: "timeline",
    locate: (page) =>
      page.getByRole("heading", { name: "Educated and Experienced" }),
    styles: { "font-family": "Georgia, serif", "font-weight": "400" },
  },
  {
    remote: "skills",
    locate: (page) => page.getByRole("heading", { name: "Skilled in…" }),
    styles: { "font-weight": "400" },
  },
  {
    // Awards resolves its data after hydration, so both prerendered documents
    // show its skeleton; that fallback still has to paint styled.
    remote: "awards",
    locate: (page) => page.getByRole("status", { name: "Loading awards" }),
    styles: { display: "grid", overflow: "hidden" },
  },
];

async function expectStyling(page: Page, probe: StyleProbe, label: string) {
  const target = probe.locate(page);
  await expect(target, label).toBeVisible();
  for (const [property, value] of Object.entries(probe.styles))
    await expect(target, `${label} ${property}`).toHaveCSS(property, value);
}

// llmlint: ignore-block[changed_behavior_has_e2e] A prerendered document has only its prerendered state: the empty, loading, and error states are reached through query parameters that client-mount, so they cannot exist with JavaScript disabled. Those states keep their happy/empty/loading/error coverage on both render paths in the per-feature specs with JavaScript enabled, where each remote's CSS still arrives with its own JavaScript.
test("every prerendered route paints its remote styling with JavaScript disabled", async ({
  browser,
}) => {
  expect(routeStyling.map((probe) => probe.path).sort()).toEqual(
    prerenderedRoutePaths().sort(),
  );
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  for (const probe of routeStyling) {
    await page.goto(probe.path);
    await expectStyling(page, probe, `/${probe.path}`);
  }
  await context.close();
});

test("every prerendered home pane paints its own styling with JavaScript disabled through both render paths", async ({
  browser,
}) => {
  expect(paneStyling.map((probe) => probe.remote).sort()).toEqual(
    homeComposedRemotes().sort(),
  );
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  for (const probe of paneStyling) {
    await page.goto("");
    await expectStyling(page, probe, `${probe.remote} host-composed`);
    await page.goto(`remotes/${probe.remote}/`);
    await expectStyling(page, probe, `${probe.remote} standalone`);
  }
  await context.close();
});
// llmlint: ignore-end[changed_behavior_has_e2e]

test("navigation works with the keyboard", async ({ page }) => {
  await page.goto("");
  await page.getByRole("link", { name: "Bio", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/bio$/);
  await expect(
    page.getByRole("heading", { name: "Optimizing Life" }),
  ).toBeVisible();
});

// llmlint: ignore-block[tests_mirror_real_usage] Hydration warnings and full-document SPA regressions are explicit acceptance criteria that are observable only through browser console/error and request instrumentation; navigation and focus still use real user-facing controls.
test("leaf routes reuse prerendered DOM without hydration warnings and navigate as an SPA", async ({
  browser,
}) => {
  for (const route of pages.filter(({ path }) => path)) {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto(`${route.path}#main-content`, { waitUntil: "networkidle" });
    await expect(
      page.getByRole("heading", { name: route.heading }),
    ).toBeVisible();
    await expect(page.getByRole("main")).toBeFocused();
    expect(errors).toEqual([]);

    let documentRequests = 0;
    page.on("request", (request) => {
      if (request.isNavigationRequest()) documentRequests += 1;
    });
    await page.getByRole("link", { name: "Home", exact: true }).click();
    await expect(page).toHaveURL(/nick-derobertis-site\/$/);
    await page.getByRole("link", { name: route.link, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${route.path}$`));
    expect(documentRequests).toBe(0);
    await page.close();
  }
});

test("query-only route states client-mount without hydration warnings", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("research?research-scenario=empty", {
    waitUntil: "networkidle",
  });
  await expect(
    page.getByRole("heading", { name: "No research projects yet" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("Home reuses prerendered content without hydration warnings", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("", { waitUntil: "networkidle" });
  await expect(
    page.getByRole("heading", { name: "Finance researcher & educator" }),
  ).toBeVisible();
  await expect(
    page.getByText("Who am I?", { exact: false }).first(),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
// llmlint: ignore-end[tests_mirror_real_usage]

test("the static 404 is intentional and the router recovers unknown routes", async ({
  browser,
  page,
}) => {
  const noScript = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await noScript.newPage();
  await staticPage.goto("missing");
  await expect(
    staticPage.getByRole("heading", { name: "Loading requested page" }),
  ).toBeVisible();
  await noScript.close();

  await page.goto("missing");
  await expect(page).toHaveURL(/nick-derobertis-site\/?$/);
  await expect(
    page.getByRole("heading", { name: "Finance researcher & educator" }),
  ).toBeVisible();
});
