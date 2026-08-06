import {
  expect,
  type Locator,
  type Page,
  type Route,
  test,
} from "@playwright/test";
import {
  type HomePaneRemote,
  homePanes,
  type RoutePath,
  siteRoutes,
} from "@site/e2e-harness";

// The route inventory and the panes Home composes are one contract each, owned
// by @site/e2e-harness and joined there to the manifests that publish them.
const pages = siteRoutes();

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
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  for (const route of pages) {
    await page.goto(route.path);
    await expect(
      page.getByText(route.feature, { exact: false }).first(),
    ).toBeVisible();
  }
  await context.close();
});

interface StyleProbe {
  locate: (page: Page) => Locator;
  styles: Record<string, string>;
}

// Every probe pins a style that only the feature's own remote stylesheet
// declares, so it can pass only while that CSS reaches the browser without any
// federated JavaScript. Keying both tables by the shared contract's own route
// and pane names is what keeps a new route or pane from shipping unprobed.
const routeStyling: Record<RoutePath, StyleProbe> = {
  "": {
    locate: (page) =>
      page
        .getByRole("region", { name: "Areas of work" })
        .getByRole("article")
        .first(),
    styles: { "text-align": "center" },
  },
  bio: {
    locate: (page) => page.getByRole("heading", { name: "Optimizing Life" }),
    styles: { "text-align": "center", "font-weight": "400" },
  },
  research: {
    locate: (page) => page.getByRole("heading", { name: "Research Works" }),
    styles: { "font-family": "Georgia, serif", color: "rgb(255, 255, 255)" },
  },
  software: {
    locate: (page) =>
      page
        .getByRole("img", { name: "Python Tools for Working with Data logo" })
        .first(),
    styles: { width: "40px", "flex-basis": "40px" },
  },
  courses: {
    locate: (page) => page.getByRole("heading", { name: "Courses" }),
    styles: { "font-family": "Georgia, serif" },
  },
};

// Home composes these panes, so its document carries their CSS too; each pane
// also owns a standalone prerendered document that links the same stylesheet.
const paneStyling: Record<HomePaneRemote, StyleProbe> = {
  "home-carousel": {
    locate: (page) => page.getByRole("region", { name: "Featured work" }),
    styles: { display: "grid", color: "rgb(255, 255, 255)" },
  },
  "home-cards": {
    locate: (page) => page.getByRole("region", { name: "Areas of work" }),
    styles: { display: "grid" },
  },
  "home-story": {
    locate: (page) => page.getByRole("heading", { name: "Who am I?" }),
    styles: { "font-family": "Georgia, serif" },
  },
  "home-contact": {
    locate: (page) =>
      page.getByRole("heading", { name: "Let’s build something useful." }),
    styles: { "font-family": "Georgia, serif" },
  },
  timeline: {
    locate: (page) =>
      page.getByRole("heading", { name: "Educated and Experienced" }),
    styles: { "font-family": "Georgia, serif", "font-weight": "400" },
  },
  skills: {
    locate: (page) => page.getByRole("heading", { name: "Skilled in…" }),
    styles: { "font-weight": "400" },
  },
  // Awards resolves its data after hydration, so both prerendered documents
  // show its skeleton; that fallback still has to paint styled.
  awards: {
    locate: (page) => page.getByRole("status", { name: "Loading awards" }),
    styles: { display: "grid", overflow: "hidden" },
  },
};

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
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  for (const route of pages) {
    await page.goto(route.path);
    await expectStyling(page, routeStyling[route.path], `/${route.path}`);
  }
  await context.close();
});

test("every prerendered home pane paints its own styling with JavaScript disabled through both render paths", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  for (const pane of homePanes()) {
    const probe = paneStyling[pane.remote];
    await page.goto(pane.host);
    await expectStyling(page, probe, `${pane.remote} host-composed`);
    await page.goto(pane.standalone);
    await expectStyling(page, probe, `${pane.remote} standalone`);
  }
  await context.close();
});
// llmlint: ignore-end[changed_behavior_has_e2e]

// The shared design-system palette reaches a visitor through the chrome the
// shell paints with it, so the header is where those values are asserted.
test("the site header paints the shared theme", async ({ page }) => {
  await page.goto("");
  await expect(page.getByRole("banner")).toHaveCSS(
    "background-color",
    "rgb(18, 50, 74)",
  );
  await expect(page.getByRole("banner")).toHaveCSS(
    "color",
    "rgb(255, 255, 255)",
  );
});

test("navigation works with the keyboard", async ({ page }) => {
  await page.goto("");
  await page.getByRole("link", { name: "Bio", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/bio$/);
  await expect(
    page.getByRole("heading", { name: "Optimizing Life" }),
  ).toBeVisible();
});

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

// Hydrating a prerendered document and throwing it away to client-render the
// same page produce identical output, so the only way to tell them apart is to
// watch whether the prerendered main landmark survives: client rendering
// empties the application root, taking the landmark with it. The observer is
// installed before the shell's deferred entry script runs.
const landmarkRemovalKey = "__prerenderedMainRemovals";

// llmlint: ignore-block[tests_mirror_real_usage] Hydration and replacement produce the same visible page, so preserving the prerendered DOM identity—the explicit acceptance criterion—cannot be distinguished through user-visible output. This helper observes only removal of the accessible main landmark; route content is still asserted through roles below.
async function watchPrerenderedMain(page: Page) {
  // llmlint: ignore-block[e2e_uses_accessible_selectors] A MutationObserver receives detached nodes, which Playwright's role-based locators cannot reach by definition; matching the main landmark element is the closest available equivalent. Every assertion about what the visitor sees still uses getByRole.
  await page.addInitScript((key: string) => {
    Reflect.set(window, key, 0);
    new MutationObserver((records) => {
      for (const record of records)
        for (const node of record.removedNodes)
          if (
            node instanceof Element &&
            (node.matches("main") || node.querySelector("main"))
          )
            Reflect.set(window, key, Number(Reflect.get(window, key)) + 1);
    }).observe(document, { childList: true, subtree: true });
  }, landmarkRemovalKey);
  // llmlint: ignore-end[e2e_uses_accessible_selectors]
  return () =>
    page.evaluate(
      (key: string) => Number(Reflect.get(window, key)),
      landmarkRemovalKey,
    );
}
// llmlint: ignore-end[tests_mirror_real_usage]

// Each leaf route owns a view-override parameter, and every one of them is
// reachable from search, social, and email with tracking parameters attached.
const leafRoutes = pages.flatMap((route) =>
  route.emptyView ? [{ ...route, emptyView: route.emptyView }] : [],
);

for (const route of leafRoutes) {
  test(`${route.path} reached with a tracking parameter hydrates its prerendered document`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    const removedMainLandmarks = await watchPrerenderedMain(page);

    await page.goto(`${route.path}?utm_source=newsletter&fbclid=abc123`, {
      waitUntil: "networkidle",
    });
    await expect(
      page.getByRole("heading", { name: route.heading, exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("banner")).toBeVisible();
    // llmlint: ignore[tests_mirror_real_usage] A zero removal count is the identity proof that the prerendered main landmark was hydrated; the resulting page is visibly identical if React replaces it.
    expect(await removedMainLandmarks()).toBe(0);
    expect(errors).toEqual([]);
  });

  test(`${route.path} reached with a view override client-renders that view`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    const removedMainLandmarks = await watchPrerenderedMain(page);

    await page.goto(
      `${route.path}?${route.emptyView.query}&utm_source=newsletter`,
      { waitUntil: "networkidle" },
    );
    await expect(
      page.getByRole("heading", { name: route.emptyView.heading, exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("article")).toHaveCount(0);
    // The static document holds the default view, so an override is only
    // reachable by replacing it.
    // llmlint: ignore[tests_mirror_real_usage] A positive removal count proves the intentionally different view replaced the prerendered landmark; visible empty-state assertions alone cannot distinguish replacement from hydration.
    expect(await removedMainLandmarks()).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });
}

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

// A route loader is the only place the running site fetches a CV domain, and it
// is reached by navigating into a route: a direct load hydrates the payload the
// prerender already baked in and asks the data host for nothing. Both ways a
// served domain can be unusable have to leave the visitor with that route's own
// recovery panel rather than a blank pane or a thrown error, on every route
// that loads a domain.
// llmlint: ignore-block[changed_behavior_has_e2e,e2e_not_mocked,tests_mirror_real_usage] A visitor reaches these states when the data host is degraded, and a host that is up and serving valid bytes cannot be asked to degrade: forcing the served status and body at the transport is the only way to put a real browser into the state under test. What is steered is the remote data host — the far side of the boundary, and the boundary these loaders exist to guard — not any part of the site. The artifact under test is the real one throughout: the composed shell, its router, its loaders, and every route remote are the deployed bytes, driven by real navigation and asserted through roles and accessible names. preload.spec.ts steers the same boundary the same way.
const unusableDomains: readonly {
  name: string;
  serve: (route: Route) => Promise<void>;
}[] = [
  {
    // A cache or gateway can answer a failed request with the last payload it
    // held, so the status is the only thing saying this is not the answer.
    name: "answers a failed request with the payload it last held",
    serve: async (route: Route) =>
      route.fulfill({ response: await route.fetch(), status: 503 }),
  },
  {
    name: "answers with a body the CV schema rejects",
    serve: (route: Route) =>
      route.fulfill({
        body: '[{"name":"not what the CV publishes"}]',
        contentType: "application/json",
        status: 200,
      }),
  },
];

const loadedRoutes: readonly {
  detail: string;
  domain: string;
  heading: string;
  link: string;
  path: string;
}[] = [
  {
    detail:
      "The research collection could not be loaded. Please try again later.",
    domain: "research",
    heading: "Research is unavailable",
    link: "Research",
    path: "research",
  },
  {
    detail: "Please try again later.",
    domain: "software_projects",
    heading: "Software projects are unavailable",
    link: "Software",
    path: "software",
  },
  {
    detail: "Please try again later.",
    domain: "courses",
    heading: "Courses are unavailable",
    link: "Courses",
    path: "courses",
  },
];

for (const route of loadedRoutes)
  for (const served of unusableDomains)
    test(`${route.link} recovers when the data host ${served.name}`, async ({
      page,
    }) => {
      await page.goto("", { waitUntil: "networkidle" });
      await page.route(
        `**/cv-data/domains/${route.domain}.json*`,
        served.serve,
      );

      await page.getByRole("link", { name: route.link, exact: true }).click();

      await expect(page).toHaveURL(
        new RegExp(`nick-derobertis-site/${route.path}$`),
      );
      await expect(
        page.getByRole("heading", { name: route.heading }),
      ).toBeVisible();
      await expect(page.getByText(route.detail).first()).toBeVisible();
      await expect(page.getByRole("banner")).toBeVisible();
    });
// llmlint: ignore-end[changed_behavior_has_e2e,e2e_not_mocked,tests_mirror_real_usage]
