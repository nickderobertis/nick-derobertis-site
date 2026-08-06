// eslint-disable-next-line @nx/enforce-module-boundaries -- The shell owns site-base routing; its spec opens the router at the same base the deployed site is served under.
import { siteBase } from "@site/data-access-core";
import { createMemoryHistory } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import BioPage from "../test-remotes/bio-page";
import CoursesPage from "../test-remotes/courses-page";
import HomePage from "../test-remotes/home-page";
import ResearchPage from "../test-remotes/research-page";
import SoftwarePage from "../test-remotes/software-page";
import { App } from "./app";
import { createSiteRouter } from "./router";

test("puts the site's router on screen", async () => {
  const router = createSiteRouter({
    history: createMemoryHistory({ initialEntries: [`${siteBase}/bio`] }),
    pages: {
      home: { component: HomePage },
      bio: { component: BioPage },
      research: { component: ResearchPage },
      software: { component: SoftwarePage },
      courses: { component: CoursesPage },
    },
    context: { loadDomain: async () => undefined as never },
  });

  render(<App router={router} />);

  expect(
    await screen.findByRole("heading", { name: "Optimizing Life" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("navigation", { name: "Primary" }),
  ).toBeInTheDocument();
});
