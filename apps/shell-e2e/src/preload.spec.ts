import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";

// llmlint: ignore-block[tests_mirror_real_usage] "Hover a link, then click, and the switch is instant" is only observable through request and DOM-mutation instrumentation, because a warm arrival is defined by requests that never repeat and skeletons that never appear. Every navigation still uses the real header links with real hover and click input.

interface SoftwareLogoProject {
  logo_base64?: string;
  logo_url?: string;
}

// Cards prefer an inline logo_base64, so only these URLs cost a request. One
// card per external URL is rendered; the URLs themselves repeat across cards.
const softwareLogoSources = (
  JSON.parse(
    readFileSync(
      "libs/data-access-core/vendor/codegen/domains/software_projects.json",
      "utf8",
    ),
  ) as SoftwareLogoProject[]
).flatMap((project) =>
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
  await page.route("**/remotes/home-carousel/*.js", async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    if (body.includes("Next featured story")) await held;
    await route.fulfill({ response, body });
  });
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
    .poll(() =>
      page.evaluate(() =>
        [...document.querySelectorAll<HTMLImageElement>("img.software-logo")]
          .filter((image) => image.currentSrc.startsWith("http"))
          .reduce(
            (totals, image) => ({
              painted:
                totals.painted +
                (image.complete && image.naturalWidth > 0 ? 1 : 0),
              requested: totals.requested + 1,
            }),
            { painted: 0, requested: 0 },
          ),
      ),
    )
    .toEqual({
      painted: softwareLogoSources.length,
      requested: softwareLogoSources.length,
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
  // Every pane arrives fully rendered because its module preload settled. The
  // awards pane still mounts in its own loading state because it owns a
  // client-side data fetch, which module preloading cannot resolve for it.
  expect(await statusRoles()).toEqual(["Loading awards"]);
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
