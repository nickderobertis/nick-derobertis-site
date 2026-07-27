import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { z } from "zod";

// llmlint: ignore-block[tests_mirror_real_usage] "Hover a link, then click, and the switch is instant" is only observable through request and DOM-mutation instrumentation, because a warm arrival is defined by requests that never repeat and skeletons that never appear. Every navigation still uses the real header links with real hover and click input.

const softwareLogoProjects = z
  .array(
    z.object({
      logo_base64: z.string().optional(),
      logo_url: z.url().optional(),
    }),
  )
  .parse(
    JSON.parse(
      readFileSync(
        "libs/data-access-core/vendor/codegen/domains/software_projects.json",
        "utf8",
      ),
    ),
  );
// Cards prefer an inline logo_base64, so only these URLs cost a request. One
// card per external URL is rendered; the URLs themselves repeat across cards.
const softwareLogoSources = softwareLogoProjects.flatMap((project) =>
  project.logo_base64 || !project.logo_url ? [] : [project.logo_url],
);
const softwareLogoUrls = [...new Set(softwareLogoSources)];
if (softwareLogoUrls.length === 0)
  throw new Error(
    "software_projects.json must ship external logo_url values for the preload journey; regenerate the vendored CV data and rerun just test-e2e",
  );

/**
 * Records the software route's own traffic. These journeys deliberately do not
 * route or stub the logo hosts: Playwright's request routing disables the HTTP
 * cache, and serving the click from that cache is the point of warming it.
 */
function recordSoftwareTraffic(page: Page) {
  const logoUrls = new Set(softwareLogoUrls);
  const logoRequests: string[] = [];
  const logoResponses: string[] = [];
  const failedLogoRequests: string[] = [];
  const domainRequests: string[] = [];
  page.on("request", (request) => {
    if (logoUrls.has(request.url())) logoRequests.push(request.url());
    else if (request.url().includes("/cv-data/domains/software_projects.json"))
      domainRequests.push(request.url());
  });
  page.on("response", (response) => {
    if (logoUrls.has(response.url()) && response.ok())
      logoResponses.push(response.url());
  });
  page.on("requestfailed", (request) => {
    if (logoUrls.has(request.url())) failedLogoRequests.push(request.url());
  });
  return { domainRequests, failedLogoRequests, logoRequests, logoResponses };
}

/**
 * Holds back the chunk carrying the carousel pane until the returned release is
 * called, so a click can land before Home's preload has settled. Its Skeleton
 * ships in a different chunk and stays available as the Suspense fallback.
 */
async function holdCarouselPane(page: Page) {
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  // llmlint: ignore-block[e2e_not_mocked,changed_behavior_has_e2e] Nothing is stubbed here: the real remote chunk is fetched from the real server and served back byte for byte, and only its arrival time moves. Deferring it is the only way to reproduce "the visitor clicked before the preload settled", which is otherwise a millisecond-wide race against a local server.
  await page.route("**/remotes/home-carousel/*.js", async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    if (body.includes("Next featured story")) await held;
    await route.fulfill({ response, body });
  });
  // llmlint: ignore-end[e2e_not_mocked,changed_behavior_has_e2e]
  return () => release();
}

declare global {
  interface Window {
    __statusRoles?: string[];
  }
}

/**
 * Records every `role="status"` skeleton that reaches the document from now on,
 * so a test can assert one never appeared rather than sampling for it.
 */
async function recordStatusRoles(page: Page) {
  // llmlint: ignore-block[e2e_uses_accessible_selectors] This observer matches on the accessible status role itself and reports each skeleton by its accessible name. Playwright locators sample the DOM as it is now, so they cannot answer "did a skeleton ever appear" — only a live MutationObserver can.
  await page.evaluate(() => {
    const seen: string[] = [];
    window.__statusRoles = seen;
    const collect = (node: Node) => {
      if (!(node instanceof Element)) return;
      for (const status of [
        ...(node.matches('[role="status"]') ? [node] : []),
        ...node.querySelectorAll('[role="status"]'),
      ])
        seen.push(
          status.getAttribute("aria-label") ?? status.textContent ?? "",
        );
    };
    collect(document.body);
    new MutationObserver((records) => {
      for (const record of records)
        for (const node of record.addedNodes) collect(node);
    }).observe(document.body, { childList: true, subtree: true });
  });
  // llmlint: ignore-end[e2e_uses_accessible_selectors]
  return () => page.evaluate(() => window.__statusRoles ?? []);
}

/**
 * Enters Bio through the /story redirect. Arriving at /bio by client-side
 * redirect proves the router owns the document, so a later hover exercises
 * route preloading instead of racing hydration.
 */
async function openBio(page: Page) {
  await page.goto("story", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/bio$/);
  await expect(
    page.getByRole("heading", { name: "Optimizing Life" }),
  ).toBeVisible();
}

const navLink = (page: Page, label: string) =>
  page.getByRole("link", { name: label, exact: true });

/**
 * Reports the card logos loaded from a URL, as the visitor's DOM shows them:
 * `sourced` counts the images the browser has settled on a URL for, `painted`
 * counts those that decoded. Inline logo_base64 cards are excluded, since they
 * never cost a request and a warmed cache cannot change anything about them.
 */
async function countUrlLogoImages(page: Page) {
  const images = await Promise.all(
    (await page.getByRole("img").all()).map((logo) =>
      logo.evaluate((image: HTMLImageElement) => ({
        fromUrl: image.currentSrc.startsWith("http"),
        painted: image.complete && image.naturalWidth > 0,
      })),
    ),
  );
  const fromUrl = images.filter((image) => image.fromUrl);
  return {
    painted: fromUrl.filter((image) => image.painted).length,
    sourced: fromUrl.length,
  };
}

test("hovering Software preloads its domain data and every card logo", async ({
  page,
}) => {
  const { domainRequests, logoRequests } = recordSoftwareTraffic(page);
  await openBio(page);
  expect(domainRequests).toEqual([]);
  expect(logoRequests).toEqual([]);

  await navLink(page, "Software").hover();

  await expect
    .poll(() => [...logoRequests].sort())
    .toEqual([...softwareLogoUrls].sort());
  expect(domainRequests).toHaveLength(1);
  await expect(
    page.getByRole("heading", { name: "Open-Source Software" }),
  ).toHaveCount(0);
});

test("clicking Software after its preload settles renders warm, skeleton-free cards", async ({
  page,
}) => {
  const { failedLogoRequests, logoRequests, logoResponses } =
    recordSoftwareTraffic(page);
  await openBio(page);
  await navLink(page, "Software").hover();
  await expect.poll(() => logoResponses.length).toBe(softwareLogoUrls.length);
  const warmedRequests = logoRequests.length;
  const statusRoles = await recordStatusRoles(page);

  await navLink(page, "Software").click();

  await expect(
    page.getByRole("heading", { name: "Open-Source Software" }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Software projects").getByRole("article"),
  ).toHaveCount(72);
  expect(await statusRoles()).toEqual([]);

  // Browsing the grid the way a visitor would paints every external logo from
  // the warmed cache; none of them costs a request after the click.
  for (const logo of await page.getByRole("img").all())
    await logo.scrollIntoViewIfNeeded();
  await expect
    .poll(() => countUrlLogoImages(page))
    .toEqual({
      painted: softwareLogoSources.length,
      sourced: softwareLogoSources.length,
    });
  expect(failedLogoRequests).toEqual([]);
  expect(logoRequests).toHaveLength(warmedRequests);
});

test("clicking Home after its preload settles mounts every pane without a skeleton", async ({
  page,
}) => {
  await openBio(page);
  await navLink(page, "Home").hover();
  await page.waitForLoadState("networkidle");
  const statusRoles = await recordStatusRoles(page);

  await navLink(page, "Home").click();

  await expect(
    page.getByRole("region", { name: "Featured work" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Areas of work" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Who am I?" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Let’s build something useful." }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Timeline visualization" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Selected awards" }),
  ).toBeVisible();
  // All seven panes arrive fully rendered: their modules and the one pane that
  // fetches its own data were both warmed, so no skeleton mounts at all.
  expect(await statusRoles()).toEqual([]);
});

test("clicking Home recovers when the warmed awards data is unavailable", async ({
  page,
}) => {
  // llmlint: ignore-block[e2e_not_mocked] Nothing about the app is stubbed: this makes the awards endpoint answer 503, the real upstream failure the pane's error state exists for. No query-string scenario can reach it, because a client-side navigation to "/" drops the search the awards pane reads.
  await page.route("**/cv-data/domains/awards.json*", (route) =>
    route.fulfill({
      status: 503,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ error: "awards unavailable" }),
    }),
  );
  // llmlint: ignore-end[e2e_not_mocked]
  await openBio(page);
  await navLink(page, "Home").hover();
  await page.waitForLoadState("networkidle");

  await navLink(page, "Home").click();

  await expect(
    page.getByRole("alert").filter({ hasText: "Awards unavailable" }),
  ).toBeVisible();
  // A pane that cannot warm must not hold back the six that need no data.
  await expect(
    page.getByRole("region", { name: "Featured work" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Who am I?" })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Timeline visualization" }),
  ).toBeVisible();
});

test("clicking Home before its preload settles still shows pane skeletons", async ({
  page,
}) => {
  const releaseCarouselPane = await holdCarouselPane(page);
  await openBio(page);

  await navLink(page, "Home").click();

  await expect(
    page.getByRole("status", { name: "Loading featured work", exact: true }),
  ).toBeVisible();

  releaseCarouselPane();

  await expect(
    page.getByRole("region", { name: "Featured work" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Who am I?" })).toBeVisible();
});
// llmlint: ignore-end[tests_mirror_real_usage]
