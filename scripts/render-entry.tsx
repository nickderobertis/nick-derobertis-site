import { cvDataClient } from "@site/data-access-core";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { prerender } from "react-dom/static";
import BioPage from "../apps/bio/src/page";
import CoursesPage from "../apps/courses/src/page";
import ResearchPage from "../apps/research/src/page";
import { createSiteRouter } from "../apps/shell/src/router";
import SoftwarePage from "../apps/software/src/page";

function HomePlaceholder() {
  return (
    <section className="hero">
      <p className="eyebrow">Nick DeRobertis</p>
      <h1>Finance, research, and software</h1>
      <p>Welcome to the professional site of Nick DeRobertis.</p>
      <p>Who am I?</p>
    </section>
  );
}

export async function renderRoute(path: string) {
  const url = new URL(path, "https://prerender.invalid");
  const domains = {
    research: cvDataClient.domain("research"),
    software_projects: cvDataClient.domain("software_projects"),
    courses: cvDataClient.domain("courses"),
  };
  const router = createSiteRouter({
    history: createMemoryHistory({
      initialEntries: [`/nick-derobertis-site${url.pathname}${url.search}`],
    }),
    pages: {
      home: HomePlaceholder,
      bio: BioPage,
      research: ResearchPage,
      software: SoftwarePage,
      courses: CoursesPage,
    },
    context: {
      loadDomain: async (name) => domains[name] as never,
      search: url.searchParams,
    },
  });
  await router.load();
  const { prelude } = await prerender(<RouterProvider router={router} />);
  return {
    html: await new Response(prelude).text(),
    state:
      url.pathname === "/research"
        ? { research: domains.research }
        : url.pathname === "/software"
          ? { software_projects: domains.software_projects }
          : url.pathname === "/courses"
            ? { courses: domains.courses }
            : {},
  };
}
