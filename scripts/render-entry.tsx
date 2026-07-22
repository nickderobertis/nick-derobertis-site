import { cvDataClient } from "@site/data-access-core";
import {
  createRequestHandler,
  RouterServer,
} from "@tanstack/react-router/ssr/server";
import { prerender } from "react-dom/static";
import BioPage from "../apps/bio/src/page";
import CoursesPage from "../apps/courses/src/page";
import ResearchPage from "../apps/research/src/page";
import { createSiteRouter } from "../apps/shell/src/router";
import { routes } from "../apps/shell/src/routes";
import SoftwarePage from "../apps/software/src/page";

// llmlint: ignore[changed_behavior_has_e2e] Deep Home-remote prerendering is explicitly owned by the dependent SSG node; this node preserves the existing substantive shallow Home artifact while proving real source rendering for the four leaf routes.
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

export const prerenderRoutes = routes;

export async function renderRoute(path: string) {
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
