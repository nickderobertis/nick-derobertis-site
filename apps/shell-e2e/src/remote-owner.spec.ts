import { expect, test } from "@playwright/test";

const contracts = {
  home: {
    host: "",
    standalone: "remotes/home/",
    role: "heading",
    name: "Finance researcher & educator",
  },
  "home-carousel": {
    host: "",
    standalone: "remotes/home-carousel/",
    role: "region",
    name: "Featured work",
  },
  "home-cards": {
    host: "",
    standalone: "remotes/home-cards/",
    role: "region",
    name: "Areas of work",
  },
  "home-story": {
    host: "",
    standalone: "remotes/home-story/",
    role: "heading",
    name: "Who am I?",
  },
  "home-contact": {
    host: "",
    standalone: "remotes/home-contact/",
    role: "heading",
    name: "Let’s build something useful.",
  },
  bio: {
    host: "bio",
    standalone: "remotes/bio/",
    role: "heading",
    name: "Optimizing Life",
  },
  research: {
    host: "research",
    standalone: "remotes/research/",
    role: "heading",
    name: "Research Works",
  },
  software: {
    host: "software",
    standalone: "remotes/software/",
    role: "heading",
    name: "Open-Source Software",
  },
  courses: {
    host: "courses",
    standalone: "remotes/courses/",
    role: "heading",
    name: "Courses",
  },
  timeline: {
    host: "",
    standalone: "remotes/timeline/",
    role: "heading",
    name: "Educated and Experienced",
  },
  skills: {
    host: "",
    standalone: "remotes/skills/",
    role: "heading",
    name: "Skilled in…",
  },
  awards: {
    host: "",
    standalone: "remotes/awards/",
    role: "heading",
    name: "Selected awards",
  },
} as const;

const owner = process.env.E2E_REMOTE;
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

test.skip(!validOwner, "remote ownership tests run through remote e2e targets");
