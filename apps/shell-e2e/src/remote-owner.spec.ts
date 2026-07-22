import { expect, test } from "@playwright/test";

const contracts = {
  home: {
    host: "",
    standalone: "remotes/home/",
    role: "heading",
    name: "Finance researcher & educator",
    loadingName: "Loading home",
  },
  "home-carousel": {
    host: "",
    standalone: "remotes/home-carousel/",
    role: "region",
    name: "Featured work",
    loadingName: "Loading featured work",
  },
  "home-cards": {
    host: "",
    standalone: "remotes/home-cards/",
    role: "region",
    name: "Areas of work",
    loadingName: "Loading areas of work",
  },
  "home-story": {
    host: "",
    standalone: "remotes/home-story/",
    role: "heading",
    name: "Who am I?",
    loadingName: "Loading story",
  },
  "home-contact": {
    host: "",
    standalone: "remotes/home-contact/",
    role: "heading",
    name: "Let’s build something useful.",
    loadingName: "Loading contact options",
  },
  bio: {
    host: "bio",
    standalone: "remotes/bio/",
    role: "heading",
    name: "Optimizing Life",
    loadingName: "Loading biography",
  },
  research: {
    host: "research",
    standalone: "remotes/research/",
    role: "heading",
    name: "Research Works",
    loadingName: "Loading research",
  },
  software: {
    host: "software",
    standalone: "remotes/software/",
    role: "heading",
    name: "Open-Source Software",
    loadingName: "Loading software",
  },
  courses: {
    host: "courses",
    standalone: "remotes/courses/",
    role: "heading",
    name: "Courses",
    loadingName: "Loading courses",
  },
  timeline: {
    host: "",
    standalone: "remotes/timeline/",
    role: "heading",
    name: "Educated and Experienced",
    loadingName: "Loading timeline",
  },
  skills: {
    host: "",
    standalone: "remotes/skills/",
    role: "heading",
    name: "Skilled in…",
    loadingName: "Loading skills",
  },
  awards: {
    host: "",
    standalone: "remotes/awards/",
    role: "heading",
    name: "Selected awards",
    loadingName: "Loading awards",
  },
} as const;

const owner = process.env.E2E_REMOTE;
if (owner && !(owner in contracts))
  throw new Error(`E2E_REMOTE names unknown remote ${owner}`);
const validOwner = owner && owner in contracts;
const contract = validOwner
  ? contracts[owner as keyof typeof contracts]
  : contracts.home;

for (const [render, path] of [
  ["host-composed", contract.host],
  ["standalone", contract.standalone],
] as const)
  test(`${owner} renders through its ${render} boundary`, async ({ page }) => {
    const failures: string[] = [];
    page.on("response", (response) => {
      if (response.status() >= 400)
        failures.push(`${response.status()} ${response.url()}`);
    });
    await page.goto(path);
    await expect(
      page.getByRole(contract.role, { name: contract.name, exact: true }),
    ).toBeVisible();
    expect(failures).toEqual([]);
  });

for (const [render, path] of [
  ["host-composed", contract.host],
  ["standalone", contract.standalone],
] as const)
  test(`${owner} shows its skeleton while loading through its ${render} boundary`, async ({
    page,
  }) => {
    let pageChunkRequested = false;
    await page.route(`**/remotes/${owner}/*.js`, async (route) => {
      const filename = new URL(route.request().url()).pathname
        .split("/")
        .at(-1);
      const isPageChunk =
        filename !== "remoteEntry.js" &&
        !filename?.startsWith("main.") &&
        !filename?.startsWith("__federation_expose_Skeleton.");
      if (isPageChunk) {
        pageChunkRequested = true;
        await new Promise((resolve) => setTimeout(resolve, 1_000));
      }
      await route.continue();
    });

    await page.goto(path, { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("status", { name: contract.loadingName, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole(contract.role, { name: contract.name, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("status", { name: contract.loadingName, exact: true }),
    ).toBeHidden();
    expect(pageChunkRequested).toBe(true);
  });

test.skip(!validOwner, "remote ownership tests run through remote e2e targets");
