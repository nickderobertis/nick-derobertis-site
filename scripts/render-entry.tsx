import { cvDataClient } from "@site/data-access-core";
import {
  createRequestHandler,
  RouterServer,
} from "@tanstack/react-router/ssr/server";
import type { ReactNode } from "react";
import { prerender } from "react-dom/static";
import AwardsPage from "../apps/awards/src/page";
import BioPage from "../apps/bio/src/page";
import CoursesPage from "../apps/courses/src/page";
import HomeCardsPage from "../apps/home-cards/src/page";
import HomeCarouselPage from "../apps/home-carousel/src/page";
import HomeContactPage from "../apps/home-contact/src/page";
import HomeStoryPage from "../apps/home-story/src/page";
import ResearchPage from "../apps/research/src/page";
import { createSiteRouter } from "../apps/shell/src/router";
import { routes } from "../apps/shell/src/routes";
import SkillsPage from "../apps/skills/src/page";
import SoftwarePage from "../apps/software/src/page";
import TimelinePage from "../apps/timeline/src/page";

function HomePage() {
  return (
    <div className="home-main">
      <HomeCarouselPage />
      <HomeCardsPage />
      <HomeStoryPage />
      <SkillsPage />
      <AwardsPage />
      <HomeContactPage />
      <TimelinePage />
    </div>
  );
}

export const prerenderRoutes = routes;

const standaloneRemotes: Record<string, () => ReactNode> = {
  timeline: () => <TimelinePage />,
  awards: () => <AwardsPage />,
  skills: () => <SkillsPage />,
  "home-carousel": () => <HomeCarouselPage />,
  "home-cards": () => <HomeCardsPage />,
  "home-story": () => <HomeStoryPage />,
  "home-contact": () => <HomeContactPage />,
};

export const prerenderRemotes = Object.keys(standaloneRemotes);

export async function renderRemote(name: string) {
  const render = standaloneRemotes[name];
  if (!render)
    throw new Error(
      `Unknown standalone remote ${JSON.stringify(name)}. Add it to standaloneRemotes in scripts/render-entry.tsx and rerun just prerender.`,
    );
  const { prelude } = await prerender(render());
  return new Response(prelude).text();
}

export async function renderRoute(path: string) {
  if (typeof path !== "string" || !routes.some((route) => route.path === path))
    throw new Error(
      `Unknown prerender route ${JSON.stringify(path)}. Add it to apps/shell/src/routes.json and rerun just prerender.`,
    );
  const url = new URL(path, "https://prerender.invalid");
  const domains = {
    research: cvDataClient.domain("research"),
    software_projects: cvDataClient.domain("software_projects"),
    courses: cvDataClient.domain("courses"),
  };
  let rendered: { html: string; hydration: string } | undefined;
  const handler = createRequestHandler({
    request: new Request(
      `https://prerender.invalid/nick-derobertis-site${url.pathname}${url.search}`,
    ),
    createRouter: () =>
      createSiteRouter({
        pages: {
          home: { component: HomePage },
          bio: { component: BioPage },
          research: { component: ResearchPage },
          software: { component: SoftwarePage },
          courses: { component: CoursesPage },
        },
        // The prerender domain table is complete; the router's generic callback
        // narrows the selected value from its validated domain name.
        context: { loadDomain: async (name) => domains[name] as never },
      }),
  });
  await handler(async ({ router }) => {
    while (!router.serverSsr?.isSerializationFinished()) {
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    const { prelude } = await prerender(<RouterServer router={router} />);
    router.serverSsr?.setRenderFinished();
    rendered = {
      html: await new Response(prelude).text(),
      hydration: router.serverSsr?.takeBufferedHtml() ?? "",
    };
    return new Response(rendered.html);
  });
  if (!rendered)
    throw new Error(
      `TanStack Router did not render ${path}. Verify the static route tree and loader in apps/shell/src/router.tsx, then rerun just prerender.`,
    );
  return rendered;
}
