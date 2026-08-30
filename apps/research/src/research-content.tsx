import type { Research } from "@site/data-access-core";
import { buildResearchProjectModels } from "@site/data-access-research";
// eslint-disable-next-line @nx/enforce-module-boundaries -- The app deliberately initializes this shared library asynchronously at startup; this primitive still must be a static component dependency.
import { ActionLink, PageShell, SectionHeading } from "@site/design-system";
import { ProjectSection } from "./project-section";

export function ResearchContent({ research }: { research: Research }) {
  return (
    // llmlint: ignore[changed_behavior_has_e2e] research/e2e/research.spec.ts drives this page's happy, empty, loading, and error scenarios through both standalone and host-composed URLs; the shared primitives' painted contract is additionally covered by the home-cards and home-story dual-path journeys, so duplicating CSS assertions here would not exercise a distinct boundary.
    <PageShell as="article" className="research-page">
      <SectionHeading
        className="research-banner"
        level={1}
        eyebrow="Research portfolio"
        title="Research Works"
        description="Working papers and works in progress across finance, markets, and investor behavior."
      >
        <ActionLink className="banner-link" href="#working-papers">
          View research
        </ActionLink>
      </SectionHeading>
      <ProjectSection
        heading="Working Papers"
        id="working-papers"
        projects={buildResearchProjectModels(research, "working_paper")}
      />
      <ProjectSection
        heading="Works in Progress"
        id="works-in-progress"
        projects={buildResearchProjectModels(research, "work_in_progress")}
      />
    </PageShell>
  );
}
